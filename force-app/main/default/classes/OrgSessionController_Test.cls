@isTest
private class OrgSessionController_Test {
  @isTest
  static void testGetSessionId() {
    Test.startTest();
    String sessionId = OrgSessionController.getSessionId();
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
    String domainUrl = OrgSessionController.getOrgDomainUrl();
    Test.stopTest();
    System.assertNotEquals(
      null,
      domainUrl,
      'Should retrieve a non-null org domain URL'
    );
  }
}
