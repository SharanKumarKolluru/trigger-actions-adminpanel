@isTest
private class OrgSessionController_Test {
  @isTest
  static void testGetSessionIdMocked() {
    OrgSessionController.mockSessionId = 'test-session-id';
    Test.startTest();
    String sessionId = OrgSessionController.getSessionId();
    Test.stopTest();
    System.assertEquals(
      'test-session-id',
      sessionId,
      'Should return mocked session ID'
    );
  }

  @isTest
  static void testGetSessionIdLive() {
    // With no mock set, exercises the try/catch PageReference path.
    // In a packaging scratch org the VF page may not render, hitting the catch branch.
    Test.startTest();
    String sessionId = OrgSessionController.getSessionId();
    Test.stopTest();
    System.assert(sessionId != null, 'Should return a non-null value');
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
