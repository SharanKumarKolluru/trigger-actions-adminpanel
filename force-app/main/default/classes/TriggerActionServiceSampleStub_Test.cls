@isTest
private class TriggerActionServiceSampleStub_Test {
  @isTest
  static void testBeforeInsert() {
    TriggerActionServiceSampleStub stub = new TriggerActionServiceSampleStub();
    Test.startTest();
    stub.beforeInsert(new List<SObject>());
    Test.stopTest();
  }
}
