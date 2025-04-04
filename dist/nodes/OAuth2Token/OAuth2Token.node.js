"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Token = void 0;
const n8n_workflow_1 = require("n8n-workflow");
class OAuth2Token {
    constructor() {
        this.description = {
            displayName: 'OAuth2 Token',
            name: 'OAuth2Token',
            icon: 'file:oauth2.svg',
            group: ['transform'],
            version: 1,
            subtitle: 'Get OAuth2 Access Token',
            description: 'Retrieves a valid OAuth2 access token from credentials',
            defaults: {
                name: 'OAuth2 Token',
            },
            inputs: ["main" /* NodeConnectionType.Main */],
            outputs: ["main" /* NodeConnectionType.Main */],
            credentials: [
                {
                    name: 'oAuth2Api',
                    required: true,
                    displayOptions: {
                        show: {
                            authentication: [
                                'genericOAuth2Api',
                            ],
                        },
                    },
                },
            ],
            properties: [
                {
                    displayName: 'Authentication',
                    name: 'authentication',
                    type: 'options',
                    options: [
                        {
                            name: 'Generic OAuth2 API',
                            value: 'genericOAuth2Api',
                        },
                    ],
                    default: 'genericOAuth2Api',
                    description: 'The authentication method to use',
                },
                {
                    displayName: 'Access Token Field Name',
                    name: 'accessTokenFieldName',
                    type: 'string',
                    default: 'accessToken',
                    required: true,
                    description: 'Name of the field where the access token will be added to the output',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        // Get the field name parameter once since it's the same for all items
        const accessTokenFieldName = this.getNodeParameter('accessTokenFieldName', 0);
        // Get credentials for OAuth2
        const oAuth2ApiCredentials = await this.getCredentials('oAuth2Api');
        n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Retrieved credentials, checking for access token');
        // Try to find the access token in various common locations
        let accessToken;
        // Check common property names directly
        if (oAuth2ApiCredentials.accessToken) {
            accessToken = oAuth2ApiCredentials.accessToken;
        }
        else if (oAuth2ApiCredentials.access_token) {
            accessToken = oAuth2ApiCredentials.access_token;
        }
        else if (oAuth2ApiCredentials.token) {
            accessToken = oAuth2ApiCredentials.token;
        }
        else if (oAuth2ApiCredentials.oauth && oAuth2ApiCredentials.oauth.access_token) {
            accessToken = oAuth2ApiCredentials.oauth.access_token;
        }
        else if (oAuth2ApiCredentials.data && oAuth2ApiCredentials.data.access_token) {
            accessToken = oAuth2ApiCredentials.data.access_token;
        }
        else if (oAuth2ApiCredentials.oauthTokenData) {
            // Some implementations store it in oauthTokenData
            const tokenData = oAuth2ApiCredentials.oauthTokenData;
            accessToken = (tokenData.access_token || tokenData.accessToken);
        }
        // Log credential structure for debugging (securely)
        n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Credential structure', {
            credKeys: Object.keys(oAuth2ApiCredentials),
            hasOAuthTokenData: !!oAuth2ApiCredentials.oauthTokenData,
            tokenFound: !!accessToken
        });
        if (!accessToken) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No access token available in the OAuth2 credentials. Please check your OAuth2 configuration and ensure the credentials are properly authorized. The credential data does not contain an accessToken, access_token, or token property.');
        }
        // Log access token for debugging (securely)
        n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Successfully retrieved access token', {
            tokenPreview: typeof accessToken === 'string' ?
                `${accessToken.substring(0, 4)}...${accessToken.substring(accessToken.length - 4)}` :
                '<non-string token>'
        });
        // Iterates over all input items and add the access token to each item
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const item = items[itemIndex];
                // Add access token to the item directly
                item.json[accessTokenFieldName] = accessToken;
                n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Current item.json state', {
                    itemIndex,
                    itemJson: JSON.stringify(item.json)
                });
                n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Added access token to item', { itemIndex });
            }
            catch (error) {
                // Handle errors properly with context
                if (this.continueOnFail()) {
                    // If continueOnFail is enabled, push error item and continue
                    items.push({
                        json: { error: error.message || 'Unknown error' },
                        pairedItem: { item: itemIndex }
                    });
                }
                else {
                    // If error already has context, add itemIndex
                    if (error.context) {
                        error.context.itemIndex = itemIndex;
                        throw error;
                    }
                    // Otherwise create NodeOperationError with context
                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), error.message, {
                        itemIndex,
                    });
                }
            }
        }
        n8n_workflow_1.LoggerProxy.debug('OAuth2Token: Execution completed successfully', {
            itemCount: items.length
        });
        return [items];
    }
}
exports.OAuth2Token = OAuth2Token;
