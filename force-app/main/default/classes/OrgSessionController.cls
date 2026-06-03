public with sharing class OrgSessionController {
  /**
   * @description Fetches the API-enabled session ID by loading the SessionIdPage Visualforce page.
   * @return String The current session ID, or empty string if an error occurs.
   */
  @AuraEnabled(cacheable=true)
  public static String getSessionId() {
    if (Test.isRunningTest()) {
      return 'test-session-id';
    }
    try {
      PageReference sessionPage = Page.SessionIdPage;
      return sessionPage.getContent().toString().trim();
    } catch (Exception e) {
      return '';
    }
  }

  /**
   * @description Fetches the base instance URL for the org.
   * @return String The base URL.
   */
  @AuraEnabled(cacheable=true)
  public static String getOrgDomainUrl() {
    return Url.getOrgDomainUrl().toExternalForm();
  }
}
