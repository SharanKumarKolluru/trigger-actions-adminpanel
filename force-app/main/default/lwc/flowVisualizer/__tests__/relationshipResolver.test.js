import {
  resolveFlowRecordReferences,
  clearDescribeCache,
  collectRecordPaths,
  deepReplace
} from "../relationshipResolver";

// Mock global fetch
global.fetch = jest.fn();

const MOCK_SESSION = "00D000000000001!mock";
const MOCK_DOMAIN = "https://example.my.salesforce.com";
const MOCK_API = "v66.0";

function mockDescribe(sobjectName, fields = [], childRelationships = []) {
  return {
    fields: fields.map((f) => ({
      name: f.name,
      relationshipName: f.relationshipName || null,
      referenceTo: f.referenceTo || [],
      type: f.type || "string"
    })),
    childRelationships: childRelationships.map((cr) => ({
      childSObject: cr.childSObject,
      field: cr.field || "Id",
      relationshipName: cr.relationshipName || null
    }))
  };
}

function setupFetch(describeMap) {
  global.fetch.mockImplementation((url) => {
    for (const [sobject, describe] of Object.entries(describeMap)) {
      if (url.includes(`/sobjects/${sobject}/describe`)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(describe)
        });
      }
    }
    return Promise.resolve({ ok: false });
  });
}

beforeEach(() => {
  clearDescribeCache();
  global.fetch.mockReset();
});

// ─── collectRecordPaths ──────────────────────────────────────────

describe("collectRecordPaths", () => {
  it("should find $Record paths in nested objects", () => {
    const metadata = {
      start: { object: "Account" },
      recordUpdates: {
        inputReference: "$Record",
        inputAssignments: [
          { field: "Name", value: { elementReference: "$Record.Name" } }
        ]
      }
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toContain("$Record");
    expect(paths).toContain("$Record.Name");
    expect(paths).toHaveLength(2);
  });

  it("should find $Record__c paths", () => {
    const metadata = {
      decisions: {
        rules: {
          conditions: { leftValueReference: "$Record__c.Status" }
        }
      }
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toContain("$Record__c.Status");
  });

  it("should find multi-hop paths", () => {
    const metadata = {
      decisions: {
        rules: {
          conditions: { leftValueReference: "$Record.Owner.Email" }
        }
      }
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toContain("$Record.Owner.Email");
  });

  it("should return empty array for metadata without $Record", () => {
    const metadata = {
      start: { object: "Account" },
      assignments: {
        assignmentItems: [{ assignToReference: "myVar", operator: "Assign" }]
      }
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toHaveLength(0);
  });

  it("should find multiple $Record references in a single string", () => {
    const metadata = {
      formulas: {
        expression: "$Record.Name & ' - ' & $Record.Owner.Name"
      }
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toContain("$Record.Name");
    expect(paths).toContain("$Record.Owner.Name");
  });

  it("should deduplicate identical paths", () => {
    const metadata = {
      recordUpdates: [
        { inputReference: "$Record" },
        { inputReference: "$Record" }
      ]
    };

    const paths = collectRecordPaths(metadata);
    expect(paths).toEqual(["$Record"]);
  });
});

// ─── deepReplace ─────────────────────────────────────────────────

describe("deepReplace", () => {
  it("should replace strings in a flat object", () => {
    const obj = { a: "$Record", b: "hello" };
    const result = deepReplace(obj, [["$Record", "Account"]]);

    expect(result).toEqual({ a: "Account", b: "hello" });
    // Original not mutated
    expect(obj.a).toBe("$Record");
  });

  it("should replace strings in nested objects", () => {
    const obj = {
      level1: {
        level2: { val: "$Record.Name" }
      }
    };
    const result = deepReplace(obj, [["$Record", "Account"]]);

    expect(result.level1.level2.val).toBe("Account.Name");
  });

  it("should replace strings in arrays", () => {
    const obj = { items: ["$Record", "other", "$Record.Id"] };
    const result = deepReplace(obj, [["$Record", "Account"]]);

    expect(result.items).toEqual(["Account", "other", "Account.Id"]);
  });

  it("should replace longer matches first to avoid substring collisions", () => {
    const obj = { val: "$Record.Owner.Email" };
    const result = deepReplace(obj, [
      ["$Record.Owner.Email", "Account.Owner.Email"],
      ["$Record.Owner", "Account.Owner"],
      ["$Record", "Account"]
    ]);

    expect(result.val).toBe("Account.Owner.Email");
  });

  it("should handle null and non-string primitives", () => {
    const obj = { a: null, b: 42, c: true, d: undefined };
    const result = deepReplace(obj, [["$Record", "Account"]]);

    expect(result).toEqual({ a: null, b: 42, c: true, d: undefined });
  });
});

// ─── resolveFlowRecordReferences ─────────────────────────────────

describe("resolveFlowRecordReferences", () => {
  it("should return metadata unchanged for non-record-triggered flows", async () => {
    const metadata = {
      processType: "AutoLaunchedFlow",
      start: { connector: { targetReference: "DoSomething" } }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result).toBe(metadata); // Same reference, no processing
  });

  it("should return metadata unchanged when no $Record paths exist", async () => {
    const metadata = {
      start: { object: "Account", connector: { targetReference: "Assign1" } },
      assignments: {
        name: "Assign1",
        assignmentItems: [
          {
            assignToReference: "myVar",
            operator: "Assign",
            value: { stringValue: "hello" }
          }
        ]
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result).toBe(metadata);
  });

  it("should replace simple $Record with sObject name", async () => {
    const metadata = {
      start: { object: "Account", connector: { targetReference: "Update1" } },
      recordUpdates: {
        name: "Update1",
        inputReference: "$Record",
        connector: null
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.recordUpdates.inputReference).toBe("Account");
    // Original not mutated
    expect(metadata.recordUpdates.inputReference).toBe("$Record");
  });

  it("should replace $Record.Field with SObject.Field", async () => {
    const metadata = {
      start: { object: "Opportunity", connector: { targetReference: "Dec1" } },
      decisions: {
        name: "Dec1",
        rules: {
          conditions: {
            leftValueReference: "$Record.StageName",
            operator: "EqualTo",
            rightValue: { stringValue: "Closed Won" }
          }
        }
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.decisions.rules.conditions.leftValueReference).toBe(
      "Opportunity.StageName"
    );
  });

  it("should resolve multi-hop paths using describe", async () => {
    setupFetch({
      Account: mockDescribe("Account", [
        { name: "OwnerId", relationshipName: "Owner", referenceTo: ["User"] }
      ])
    });

    const metadata = {
      start: { object: "Account", connector: { targetReference: "Dec1" } },
      decisions: {
        name: "Dec1",
        rules: {
          conditions: {
            leftValueReference: "$Record.Owner.Email",
            operator: "EqualTo",
            rightValue: { stringValue: "admin@test.com" }
          }
        }
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.decisions.rules.conditions.leftValueReference).toBe(
      "Account.Owner.Email"
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/sobjects/Account/describe"),
      expect.any(Object)
    );
  });

  it("should cache describe calls across multiple paths", async () => {
    setupFetch({
      Account: mockDescribe("Account", [
        { name: "OwnerId", relationshipName: "Owner", referenceTo: ["User"] },
        {
          name: "ParentId",
          relationshipName: "Parent",
          referenceTo: ["Account"]
        }
      ])
    });

    const metadata = {
      start: { object: "Account", connector: { targetReference: "Dec1" } },
      decisions: {
        name: "Dec1",
        rules: [
          {
            conditions: { leftValueReference: "$Record.Owner.Email" }
          },
          {
            conditions: { leftValueReference: "$Record.Parent.Name" }
          }
        ]
      }
    };

    await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    // Only 1 describe call for Account, not 2
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should gracefully handle describe API failure", async () => {
    global.fetch.mockResolvedValue({ ok: false });

    const metadata = {
      start: { object: "Account", connector: { targetReference: "Dec1" } },
      decisions: {
        name: "Dec1",
        rules: {
          conditions: { leftValueReference: "$Record.Owner.Email" }
        }
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    // Still replaces $Record prefix even when describe fails
    expect(result.decisions.rules.conditions.leftValueReference).toBe(
      "Account.Owner.Email"
    );
  });

  it("should handle $Record__c variant", async () => {
    const metadata = {
      start: { object: "Custom_Obj__c", connector: { targetReference: "U1" } },
      recordUpdates: {
        name: "U1",
        inputReference: "$Record__c",
        connector: null
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.recordUpdates.inputReference).toBe("Custom_Obj__c");
  });

  it("should resolve custom relationship __r paths with heuristic fallback", async () => {
    setupFetch({
      Account: mockDescribe("Account", [])
    });

    const metadata = {
      start: { object: "Account", connector: { targetReference: "Dec1" } },
      decisions: {
        name: "Dec1",
        rules: {
          conditions: { leftValueReference: "$Record.Custom_Rel__r.Name" }
        }
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    // Prefix replaced, relationship name preserved
    expect(result.decisions.rules.conditions.leftValueReference).toBe(
      "Account.Custom_Rel__r.Name"
    );
  });

  it("should resolve multiple $Record refs in a formula expression", async () => {
    const metadata = {
      start: { object: "Account", connector: { targetReference: "F1" } },
      formulas: {
        name: "F1",
        expression: "IF($Record.Name = 'Test', $Record.Industry, 'None')"
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.formulas.expression).toBe(
      "IF(Account.Name = 'Test', Account.Industry, 'None')"
    );
  });

  it("should not mutate the original metadata", async () => {
    const metadata = {
      start: { object: "Account", connector: { targetReference: "U1" } },
      recordUpdates: {
        name: "U1",
        inputReference: "$Record",
        connector: null
      }
    };

    const original = JSON.parse(JSON.stringify(metadata));
    await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(metadata).toEqual(original);
  });

  it("should handle child relationship resolution", async () => {
    setupFetch({
      Account: mockDescribe(
        "Account",
        [],
        [{ childSObject: "Contact", relationshipName: "Contacts" }]
      )
    });

    const metadata = {
      start: { object: "Account", connector: { targetReference: "L1" } },
      recordLookups: {
        name: "L1",
        object: "Contact",
        filters: {
          field: "$Record.Contacts.Email",
          operator: "EqualTo",
          value: { stringValue: "test@test.com" }
        }
      }
    };

    const result = await resolveFlowRecordReferences(
      metadata,
      MOCK_SESSION,
      MOCK_DOMAIN,
      MOCK_API
    );

    expect(result.recordLookups.filters.field).toBe("Account.Contacts.Email");
  });
});
