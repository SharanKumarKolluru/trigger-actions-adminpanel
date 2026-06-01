@isTest
private class FlowVisualizerController_Test {
  @isTest
  static void testGetSessionId() {
    Test.startTest();
    String sessionId = FlowVisualizerController.getSessionId();
    Test.stopTest();
    System.assertEquals(
      'test-session-id',
      sessionId,
      'Should return test session ID in test context'
    );
  }

  @isTest
  static void testGetOrgDomainUrl() {
    Test.startTest();
    String domainUrl = FlowVisualizerController.getOrgDomainUrl();
    Test.stopTest();
    System.assertNotEquals(
      null,
      domainUrl,
      'Should retrieve a non-null org domain URL'
    );
  }
}
