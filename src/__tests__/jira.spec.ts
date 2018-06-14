import { context } from './types';

import {
  Jira,
  Dict,
} from '../';
import https from 'https';
import { dedent } from 'ts-dedent';

jest.mock('https');
let responseStatus: number = 902;
let responseBody: Dict<any> = {};
let requestString: string = '';
let curlString: string = '';

const requestMock = function (options, cb) {
  let url = `${options.protocol}//`;
  if (options.auth) url += `${options.auth}@`;
  url += options.hostname;
  if (options.port) url += `:${options.port}`;
  url += options.path;
  curlString +=
    `curl --request ${options.method} --url '${url}' --header 'Content-Type: application/json'` +
    ` --header 'Accept: application/json'`
  ;
  requestString = `${options.method} ${url}`;
  const callbacks: Dict<any> = {};
  cb({
    on(event, cb) {
      callbacks[event] = cb;
    },
    statusCode: responseStatus,
  });
  this.write = (str) => {
    requestString += `\n${str}`;
    curlString += ` --data '${str}'`;
  };
  this.end = () => {
    if (callbacks.data) {
      callbacks.data(JSON.stringify(responseBody));
      callbacks.end();
    }
  };
  return this;
};

/// @ts-ignore
https.request.mockImplementation(requestMock);

beforeEach(() => {
  responseStatus = 902;
  responseBody = {};
  requestString = '';
  curlString = '';
});

describe('Jira', () => {
  const url = 'https://example.com';
  const username = 'foo';
  const password = 'bar';

  const getJira = () => new Jira({ url, username, password });

  describe('#editIssue', () => {
    const updateHistory = false;
    const fields = {};
    const historyMetadata = undefined;
    const issueList = undefined;
    const properties = undefined;
    const transition = undefined;
    const update = undefined;
    const subject = () => getJira().createIssue(
      {
        fields,
        historyMetadata,
        issueList,
        properties,
        transition,
        update,
      },
      updateHistory,
    );

    it('makes call to jira API', async () => {
      await subject();
      expect(requestString).toEqual(dedent`
        POST https://foo:bar@example.com/rest/api/2/issue?updateHistory=false
        {"fields":{}}
      `);
    });

    context('when issue is created', {
      definitions() {
        responseStatus = 201;
        responseBody = { key: 'JIRA-1' };
      },
      tests() {
        it('returns issue', async () => {
          const issue = await subject();
          expect(issue).toEqual(responseBody);
        });
      },
    });

    context('when issue is not created', {
      definitions() {
        responseStatus = 400;
      },
      tests() {
        it('returns undefined', async () => {
          const issue = await subject();
          expect(issue).toBeUndefined();
        });
      },
    });
  });

  describe('#getIssue', () => {
    const issueKey = 'JIRA-1234';
    const subject = () => getJira().getIssue(issueKey);

    it('makes call to jira API', async () => {
      await subject();
      expect(requestString).toEqual(dedent`
        GET https://foo:bar@example.com/rest/api/2/issue/JIRA-1234
      `);
    });

    context('when issue is found', {
      definitions() {
        responseStatus = 200;
        responseBody = { key: issueKey };
      },
      tests() {
        it('returns issue', async () => {
          const issue = await subject();
          expect(issue).toEqual(responseBody);
        });
      },
    });

    context('when issue is not found', {
      definitions() {
        responseStatus = 404;
      },
      tests() {
        it('returns undefined', async () => {
          const issue = await subject();
          expect(issue).toBeUndefined();
        });
      },
    });
  });

  describe('#updateIssue', () => {
    const notifyUsers = false;
    const overrideEditableFlag = false;
    const overrideScreenSecurity = false;
    const fields = {};
    const historyMetadata = undefined;
    const issueList = undefined;
    const properties = undefined;
    const transition = undefined;
    const update = undefined;
    const issueKey = 'JIRA-1234';
    const subject = () => getJira().updateIssue(
      issueKey,
      {
        fields,
        historyMetadata,
        issueList,
        properties,
        transition,
        update,
      },
      {
        notifyUsers,
        overrideEditableFlag,
        overrideScreenSecurity,
      },
    );

    it('makes call to jira API', async () => {
      await subject();
      const query = 'notifyUsers=false&overrideEditableFlag=false&overrideScreenSecurity=false';
      expect(requestString).toEqual(dedent`
        PUT https://foo:bar@example.com/rest/api/2/issue/${issueKey}?${query}
        {"fields":{}}
      `);
    });

    context('when issue is updated', {
      definitions() {
        responseStatus = 204;
      },
      tests() {
        it('returns true', async () => {
          const issue = await subject();
          expect(issue).toBeTruthy();
        });
      },
    });

    context('when request is malformed', {
      definitions() {
        responseStatus = 400;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when update issue is forbidden', {
      definitions() {
        responseStatus = 403;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });
  });

  describe('#deleteIssue', () => {
    const deleteSubtasks = false;

    const issueKey = 'JIRA-1234';
    const subject = () => getJira().deleteIssue(issueKey, deleteSubtasks);

    it('makes call to jira API', async () => {
      await subject();
      expect(requestString).toEqual(dedent`
        DELETE https://foo:bar@example.com/rest/api/2/issue/${issueKey}?deleteSubtasks=false
      `);
    });

    context('when issue is deleted', {
      definitions() {
        responseStatus = 204;
      },
      tests() {
        it('returns true', async () => {
          const issue = await subject();
          expect(issue).toBeTruthy();
        });
      },
    });

    context('when request is malformed', {
      definitions() {
        responseStatus = 400;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when delete issue is unauthorized', {
      definitions() {
        responseStatus = 403;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when delete issue is forbidden', {
      definitions() {
        responseStatus = 403;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when issue is not found', {
      definitions() {
        responseStatus = 404;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });
  });

  describe('#assignIssue', () => {
    const accountId = undefined;
    const active = undefined;
    const applicationRoles = undefined;
    const avatarUrls = undefined;
    const displayName = undefined;
    const emailAddress = undefined;
    const expand = undefined;
    const groups = undefined;
    const locale = undefined;
    const name = 'foo';
    const self = undefined;
    const timeZone = undefined;
    const issueKey = 'JIRA-1234';

    const subject = () => getJira().assignIssue(issueKey, {
      accountId,
      active,
      applicationRoles,
      avatarUrls,
      displayName,
      emailAddress,
      expand,
      groups,
      locale,
      name,
      self,
      timeZone,
    });

    it('makes call to jira API', async () => {
      await subject();
      expect(requestString).toEqual(dedent`
        PUT https://foo:bar@example.com/rest/api/2/issue/${issueKey}/assignee
        {"name":"foo"}
      `);
    });

    context('when issue is updated', {
      definitions() {
        responseStatus = 204;
      },
      tests() {
        it('returns true', async () => {
          const issue = await subject();
          expect(issue).toBeTruthy();
        });
      },
    });

    context('when request is malformed', {
      definitions() {
        responseStatus = 400;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when assigning issue is unauthorized', {
      definitions() {
        responseStatus = 401;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });

    context('when issue is not found', {
      definitions() {
        responseStatus = 404;
      },
      tests() {
        it('returns false', async () => {
          const issue = await subject();
          expect(issue).toBeFalsy();
        });
      },
    });
  });
});
