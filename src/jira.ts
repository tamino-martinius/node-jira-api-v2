import {
  Dict,
  JiraConfig,
  RequestMethod,
  Issue,
  Response,
  EditIssueConfig,
  Page,
  SearchIssuesConfig,
  GeneratorConfig,
} from './types';
import { URL } from 'url';
import https from 'https';

export class Jira {
  private url: URL;
  private apiBaseUrl: URL;
  private username: string;
  private password: string;
  private version: string;

  constructor(config: JiraConfig) {
    this.url = new URL(config.url);
    this.username = config.username;
    this.password = config.password;
    this.version = config.version || '2';
    this.apiBaseUrl = new URL(`rest/api/${this.version}/`, this.url);
  }

  static paramsToQuery(params: Dict<any> = {}): string {
    const paramKeys: string[] = Object.keys(params).sort();
    if (paramKeys.length > 0) {
      return '?' + paramKeys.map(key => `${key}=${encodeURIComponent(params[key])}`).join('&');
    }
    return '';
  }

  request(
    method: RequestMethod,
    rel: string,
    params: Dict<any> = {},
    body: Dict<any> = {},
  ): Promise<Response> {
    return new Promise((resolve, reject) => {
      const url = new URL(rel, this.apiBaseUrl);
      url.username = this.username;
      url.password = this.password;
      const auth = url.username && url.password ? `${url.username}:${url.password}` : undefined;
      const options: https.RequestOptions = {
        auth,
        method,
        hostname: url.hostname,
        protocol: url.protocol,
        port: url.port,
        path: url.pathname + Jira.paramsToQuery(params),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      };
      // console.log(options, url.toJSON());

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', buffer => body += buffer.toString());
        res.on('end', () => resolve({
          data: JSON.parse(body),
          status: res.statusCode || 902,
        }));
        res.on('error', buffer => reject(JSON.parse(buffer.toString())));
      });
      const bodyKeys: string[] = Object.keys(body);
      if ((method === RequestMethod.POST || method === RequestMethod.PUT) && bodyKeys.length > 0) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  async *generate<T>(config: GeneratorConfig): AsyncIterableIterator<T> {
    let crawling = true;
    let page = 0;
    while (crawling) {
      const response = await config.fn.apply(
        this,
        ...config.args,
        { startsAt: page * config.pageSize },
      );
      page += 1;
      crawling = crawling && response.total > page * config.pageSize;
      yield* response[config.key];
    }
    return false;
  }

  async createIssue(body: Dict<any>, updateHistory: boolean = false): Promise<Issue | undefined> {
    const res = await this.request(RequestMethod.POST, `issue`, { updateHistory }, body);
    return res.status === 201 ? res.data : undefined;
  }

  async getIssue(keyOrId: string): Promise<Issue | undefined> {
    const res = await this.request(RequestMethod.GET, `issue/${keyOrId}`);
    return res.status === 200 ? res.data : undefined;
  }

  async updateIssue(keyOrId: string, body: Dict<any>, config: EditIssueConfig): Promise<boolean> {
    const res = await this.request(RequestMethod.PUT, `issue/${keyOrId}`, config, body);
    return res.status === 204;
  }

  async editIssue(
    keyOrId: string,
    body: Dict<any>,
    config: EditIssueConfig = {},
  ): Promise<Issue | undefined> {
    const success = await this.updateIssue(keyOrId, body, config);
    if (success) {
      return await this.getIssue(keyOrId);
    }
    return undefined;
  }

  async deleteIssue(keyOrId: string, deleteSubtasks: boolean = true): Promise<boolean> {
    const res = await this.request(RequestMethod.DELETE, `issue/${keyOrId}`, { deleteSubtasks });
    return res.status === 204;
  }

  async assignIssue(keyOrId: string, body: Dict<any>): Promise<boolean> {
    const res = await this.request(RequestMethod.PUT, `issue/${keyOrId}/assignee`, {}, body);
    return res.status === 204;
  }

  async addIssueAttachment(keyOrId: string, body: Dict<any>): Promise<boolean> {
    const res = await this.request(RequestMethod.POST, `issue/${keyOrId}/assignee`, {}, body);
    return res.status === 204;
  }

  async getIssueChangeLogPage(keyOrId: string, page: Page = {}): Promise<any | undefined> {
    const res = await this.request(RequestMethod.GET, `issue/${keyOrId}/changelog`, {
      maxResults: 100,
      startAt: 0,
      ...page,
    });
    return res.status === 200 ? res.data : undefined;
  }

  async getIssueCommentPage(keyOrId: string, page: Page = {}): Promise<any | undefined> {
    const res = await this.request(RequestMethod.GET, `issue/${keyOrId}/comment`, {
      maxResults: 100,
      startAt: 0,
      ...page,
      // tslint:disable-next-line:max-line-length
      // TODO orderBy, expand https://developer.atlassian.com/cloud/jira/platform/rest/#api-api-2-issue-issueIdOrKey-comment-get
    });
    return res.status === 200 ? res.data : undefined;
  }

  searchIssuesGenerator(jql: string, config: SearchIssuesConfig = {}): AsyncIterableIterator<any> {
    return this.generate({
      fn: this.searchIssuesPage,
      args: [jql, config],
      key: 'issues',
      pageSize: 100,
    });
  }

  async searchIssuesPage(
    jql: string,
    config: SearchIssuesConfig = {},
    page: Page = {},
  ): Promise<Dict<any>> {
    const expandFields = config.expand || [];
    const expand = expandFields.length > 0 ? expandFields.join(',') : undefined;
    const res = await this.request(RequestMethod.POST, `search`, {}, {
      maxResults: 100,
      startAt: 0,
      ...page,
      jql,
      expand,
      fields: config.fields,
      fieldsByKeys: config.fieldsByKeys,
      properties: config.properties,
    });
    console.log(res);

    return res.status === 200 ? res.data : {};
  }

  // tslint:disable-next-line:max-line-length
  // TODO Add Comment https://developer.atlassian.com/cloud/jira/platform/rest/#api-api-2-issue-issueIdOrKey-comment-post

  // tslint:disable-next-line:max-line-length
  // TODO Get Comment https://developer.atlassian.com/cloud/jira/platform/rest/#api-api-2-issue-issueIdOrKey-comment-id-get

  // tslint:disable-next-line:max-line-length
  // TODO Update Comment https://developer.atlassian.com/cloud/jira/platform/rest/#api-api-2-issue-issueIdOrKey-comment-id-put

  // TODO
}

export default Jira;
