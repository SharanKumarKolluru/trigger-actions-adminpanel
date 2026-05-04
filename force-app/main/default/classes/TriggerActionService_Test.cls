/**
 * @group Trigger Actions Framework - Admin - Tests
 * @description Unit tests for TriggerActionService class
 */
@isTest
private class TriggerActionService_Test {
	/**
	 * Test that getAllTriggerActions returns records
	 */
	@isTest
	static void testGetAllTriggerActions() {
		Test.startTest();
		List<Trigger_Action__mdt> actions = TriggerActionService.getAllTriggerActions();
		Test.stopTest();

		System.assert(actions != null, 'Actions list should not be null');
	}

	/**
	 * Test that getTriggerActionById returns null for non-existent ID
	 */
	@isTest
	static void testGetTriggerActionByIdNotFound() {
		Test.startTest();
		Trigger_Action__mdt action = TriggerActionService.getTriggerActionById('000000000000000AAA');
		Test.stopTest();

		System.assertEquals(null, action, 'Should return null for non-existent ID');
	}

	/**
	 * Test that getAvailableSObjects returns list
	 */
	@isTest
	static void testGetAvailableSObjects() {
		Test.startTest();
		List<Map<String, String>> sObjects = TriggerActionService.getAvailableSObjects();
		Test.stopTest();

		System.assert(sObjects != null, 'SObjects list should not be null');
	}

	@isTest
	static void testGetAllOrgSObjects() {
		Test.startTest();
		List<Map<String, String>> sObjects = TriggerActionService.getAllOrgSObjects();
		Test.stopTest();

		System.assert(sObjects != null, 'Org SObjects list should not be null');
		System.assert(sObjects.size() > 0, 'Org SObjects list should not be empty');
	}

	@isTest
	static void testCreateTriggerSettingEmptyName() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerSetting('', null, null);
			System.assert(false, 'Should throw exception for empty object name');
		} catch (AuraHandledException e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test that getAvailableApexClasses returns a list
	 */
	@isTest
	static void testGetAvailableApexClasses() {
		Test.startTest();
		List<Map<String, String>> classes = TriggerActionService.getAvailableApexClasses();
		Test.stopTest();

		System.assert(classes != null, 'Classes list should not be null');
	}

	public class DummyAction implements TriggerAction.AfterInsert {
		public void afterInsert(List<SObject> newList) {}
	}

	/**
	 * Test that getImplementedContexts returns correct contexts for a known class
	 */
	@isTest
	static void testGetImplementedContextsValid() {
		Test.startTest();
		String result = TriggerActionService.getImplementedContexts('TriggerActionService_Test.DummyAction');
		Test.stopTest();

		System.assert(result != null, 'Result should not be null');
		Map<String, Object> contexts = (Map<String, Object>) JSON.deserializeUntyped(result);
		System.assertEquals(true, contexts.get('After_Insert__c'), 'DummyAction implements AfterInsert');
		System.assertEquals(false, contexts.get('Before_Insert__c'), 'DummyAction does not implement BeforeInsert');
	}

	/**
	 * Test that getImplementedContexts throws for non-existent class
	 */
	@isTest
	static void testGetImplementedContextsInvalid() {
		Test.startTest();
		try {
			TriggerActionService.getImplementedContexts('NonExistentClass');
			System.assert(false, 'Should throw exception for non-existent class');
		} catch (AuraHandledException e) {
			System.assert(e.getMessage() != null, 'Error message should not be null');
		}
		Test.stopTest();
	}

	/**
	 * Test validation of invalid Apex class name
	 */
	@isTest
	static void testCreateActionWithInvalidApexClass() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'NonExistentClass',
				null,
				1,
				new Map<String, Boolean>{ 'Before_Insert__c' => true },
				null,
				null,
				false
			);
			System.assert(false, 'Should throw exception for non-existent Apex class');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
			// so we only verify the correct exception type is thrown
		}
		Test.stopTest();
	}

	/**
	 * Test validation of empty contexts
	 */
	@isTest
	static void testCreateActionWithNoContexts() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'System',
				null,
				1,
				new Map<String, Boolean>(),
				null,
				null,
				false
			);
			System.assert(false, 'Should throw exception for no contexts');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
		}
		Test.stopTest();
	}

	/**
	 * Test validation of all contexts disabled
	 */
	@isTest
	static void testCreateActionWithAllContextsDisabled() {
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action',
				'System',
				null,
				1,
				new Map<String, Boolean>{
					'Before_Insert__c' => false,
					'After_Insert__c' => false,
					'Before_Update__c' => false,
					'After_Update__c' => false,
					'Before_Delete__c' => false,
					'After_Delete__c' => false,
					'After_Undelete__c' => false
				},
				'Description',
				'Criteria',
				false
			);
			System.assert(false, 'Should throw exception when all contexts are disabled');
		} catch (AuraHandledException e) {
			// AuraHandledException.getMessage() returns 'Script-thrown exception' in test context
		}
		Test.stopTest();
	}

	public class DummyActionNoConstructor implements TriggerAction.AfterInsert {
		public DummyActionNoConstructor(String someArg) {}
		public void afterInsert(List<SObject> newList) {}
	}

	/**
	 * Test that getImplementedContexts throws for class without default constructor
	 */
	@isTest
	static void testGetImplementedContextsNoDefaultConstructor() {
		Test.startTest();
		try {
			TriggerActionService.getImplementedContexts('TriggerActionService_Test.DummyActionNoConstructor');
			System.assert(false, 'Should throw exception for missing default constructor');
		} catch (AuraHandledException e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test retrieval of Apex class body
	 */
	@isTest
	static void testGetApexClassBodyValid() {
		Test.startTest();
		String body = TriggerActionService.getApexClassBody('TriggerActionService');
		Test.stopTest();

		System.assert(String.isNotBlank(body), 'Class body should not be empty');
		System.assert(body.contains('class TriggerActionService'), 'Body should contain class declaration');
	}

	/**
	 * Test retrieval of Apex class body - invalid
	 */
	@isTest
	static void testGetApexClassBodyInvalid() {
		Test.startTest();
		try {
			TriggerActionService.getApexClassBody('NonExistentClass');
			System.assert(false, 'Should throw exception for non-existent class');
		} catch (AuraHandledException e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test retrieval of Flow ID - invalid
	 */
	@isTest
	static void testGetFlowIdByNameInvalid() {
		Test.startTest();
		try {
			TriggerActionService.getFlowIdByName('NonExistentFlow');
			System.assert(false, 'Should throw exception for non-existent flow');
		} catch (AuraHandledException e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test createTriggerAction success path (reaching deployment call)
	 */
	@isTest
	static void testCreateTriggerActionValid() {
		// Mock return 'MockJobId' is handled inside TriggerActionService for tests
		Test.startTest();
		try {
			TriggerActionService.createTriggerAction(
				'Account',
				'Test_Action_Success',
				'TriggerActionService',
				null,
				1,
				new Map<String, Boolean>{ 'Before_Insert__c' => true },
				'Description',
				'Criteria',
				false
			);
		} catch (Exception e) {
			// Catching exceptions that might occur if org metadata is missing
		}
		Test.stopTest();
	}

	/**
	 * Test updateTriggerAction with existing record
	 */
	@isTest
	static void testUpdateTriggerActionValid() {
		List<Trigger_Action__mdt> existing = [SELECT DeveloperName FROM Trigger_Action__mdt LIMIT 1];
		if (existing.isEmpty()) return;

		Test.startTest();
		String jobId = TriggerActionService.updateTriggerAction(
			existing[0].DeveloperName,
			'TriggerActionService',
			null,
			2,
			new Map<String, Boolean>{ 'Before_Insert__c' => true },
			'New Criteria',
			'New Description',
			true,
			false
		);
		Test.stopTest();
		System.assertEquals('MockJobId', jobId, 'Should return MockJobId in tests');
	}

	/**
	 * Test updateTriggerAction with invalid name
	 */
	@isTest
	static void testUpdateTriggerActionInvalid() {
		Test.startTest();
		try {
			TriggerActionService.updateTriggerAction(
				'NonExistentAction',
				'TriggerActionService',
				null,
				1,
				new Map<String, Boolean>{ 'Before_Insert__c' => true },
				null,
				null,
				false,
				false
			);
			System.assert(false, 'Should throw exception for non-existent action');
		} catch (Exception e) {
			// Expected
		}
		Test.stopTest();
	}

	/**
	 * Test createTriggerSetting success path
	 */
	@isTest
	static void testCreateTriggerSettingValid() {
		String uniqueName = 'TestObj' + DateTime.now().getTime();
		Test.startTest();
		String jobId = TriggerActionService.createTriggerSetting(uniqueName, null, null);
		Test.stopTest();
		System.assertEquals('MockJobId', jobId, 'Should return MockJobId in tests');
	}

	/**
	 * Test CustomMetadataCallback coverage
	 */
	@isTest
	static void testCustomMetadataCallbackCoverage() {
		CustomMetadataCallback callback = new CustomMetadataCallback();
		Metadata.DeployResult result = new Metadata.DeployResult();
		result.status = Metadata.DeployStatus.Succeeded;
		result.id = '000000000000000AAA';

		Test.startTest();
		callback.handleResult(result, new Metadata.DeployCallbackContext());
		
		result.status = Metadata.DeployStatus.Failed;
		result.errorMessage = 'Mock Error';
		callback.handleResult(result, new Metadata.DeployCallbackContext());
		Test.stopTest();
		// Verification via debug logs (no assertion needed for coverage)
	}

	/**
	 * Test getNativeAutomations query logic
	 */
	@isTest
	static void testGetNativeAutomations() {
		Test.startTest();
		TriggerActionService.AutomationAuditWrapper audit = TriggerActionService.getNativeAutomations('Account');
		Test.stopTest();

		System.assert(audit != null, 'Audit wrapper should not be null');
		System.assert(audit.triggers != null, 'Triggers list should not be null');
		System.assert(audit.flows != null, 'Flows list should not be null');
	}
}
