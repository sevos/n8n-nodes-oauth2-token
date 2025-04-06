import { IExecuteFunctions } from 'n8n-workflow';
import {
	INodeType,
	INodeTypeDescription,
	IDataObject,
	INodeExecutionData,
	NodeConnectionType,
	NodeOperationError,
	LoggerProxy,
	IHttpRequestOptions
} from 'n8n-workflow';

export class OAuth2Token implements INodeType {
	description: INodeTypeDescription = {
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
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
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
			{
                displayName: 'Dummy Request URL (Optional)',
                name: 'dummyUrl',
                type: 'string',
                default: '',
                placeholder: 'e.g., User Info Endpoint or Token URL',
                description: '(Advanced) URL for a minimal API call to trigger token refresh check. If blank, tries to use the Token URL from credentials.',
            },
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];
		
	    // Get parameters once
		const accessTokenFieldName = this.getNodeParameter('accessTokenFieldName', 0) as string;
		let dummyUrl = this.getNodeParameter('dummyUrl', 0, '') as string; // <-- ADD THIS LINE
	
		// --- Step 1: Trigger the potential refresh using a dummy request ---
		let refreshedCredentials; // <-- Declare this variable
		try {
			LoggerProxy.debug('OAuth2Token: Attempting to trigger refresh check via dummy request.');
	
			// Get initial credentials to find the token URL if dummyUrl is not provided
			const initialCredentials = await this.getCredentials('oAuth2Api');
			if (!dummyUrl) {
				// Attempt to use the Token URL from credentials as a default dummy target
				// Adjust property access based on n8n's specific OAuth2 credential structure
				// Common locations: .tokenUrl, .auth.oauth_token_url
				dummyUrl = (initialCredentials.tokenUrl || (initialCredentials.auth as IDataObject)?.oauth_token_url || '') as string;
					if (!dummyUrl) {
						LoggerProxy.warn('OAuth2Token: No Dummy Request URL provided and Token URL not found in credentials. Refresh check might not be triggered reliably.');
						// As a last resort, you could try the Auth URL, but it's less ideal
						// dummyUrl = (initialCredentials.authUrl || (initialCredentials.auth as IDataObject)?.oauth_auth_url || '') as string;
					}
			}
	
			if (!dummyUrl) {
				// If still no URL, we can't make the dummy request.
				// Proceed with potentially stale token, but warn the user.
				LoggerProxy.error('OAuth2Token: Cannot perform dummy request to ensure token refresh. No URL available. Proceeding with potentially stale token.');
				// Assign initial credentials to refreshedCredentials so the next step doesn't fail
				refreshedCredentials = initialCredentials;
			} else {
				// Define minimal request options for the dummy call
				const dummyRequestOptions: IHttpRequestOptions = {
					method: 'GET', // Or OPTIONS/HEAD if less intrusive and supported
					url: dummyUrl,
					ignoreHttpStatusErrors: true, // Don't throw on non-2xx status codes
					returnFullResponse: false, // We don't need the response body/headers
					timeout: 5000, // Short timeout
					headers: { 'Accept': 'application/json' } // Common header
				};
	
				// Use the helper function which handles the refresh logic internally
				// The .call is essential here to provide the correct 'this' context
				await this.helpers.requestOAuth2.call(
					this,
					'oAuth2Api', // Credential name
					dummyRequestOptions,
					{ tokenType: 'Bearer' } // Standard options for OAuth2 helper
				);
	
				// If the requestOAuth2 call completed (even if the dummy HTTP request itself failed *after* auth),
				// the credentials *should* have been refreshed internally if they were expired.
				LoggerProxy.debug('OAuth2Token: Dummy request attempt completed. Re-fetching credentials.');
			}
	
		} catch (error: Error | any) {
			// Log the error and attempt to proceed by fetching credentials anyway
			LoggerProxy.warn(`OAuth2Token: Dummy request or refresh check failed. Error: ${error.message}. Attempting to retrieve credentials anyway.`, { error: error.toString() });
				// In case the dummy request block failed before assigning initialCredentials
				if (!refreshedCredentials) {
					try {
						refreshedCredentials = await this.getCredentials('oAuth2Api');
					} catch (innerError: any) {
						LoggerProxy.error(`OAuth2Token: Failed even to get initial credentials after dummy request error: ${innerError.message}`);
						// Decide how to handle this - perhaps throw, perhaps continue without credentials
					}
				}
		}
		// --- END OF DUMMY REQUEST BLOCK ---
		
		// --- Step 2: Get the (potentially) refreshed credentials ---
		// Fetch credentials again *after* the dummy request attempt.
		try {
			// If the dummy request failed, refreshedCredentials might already be set in the catch block.
			// Only fetch again if it wasn't set or if the dummy request path completed without error.
			if (!refreshedCredentials || (dummyUrl && !refreshedCredentials)) { // Fetch if not set, or if dummyUrl existed and we didn't hit the error path where it was already fetched
				refreshedCredentials = await this.getCredentials('oAuth2Api');
			}
		} catch(credentialError: any) {
			// If fetching fails here, it's more serious.
			throw new NodeOperationError(this.getNode(), `Failed to retrieve OAuth2 credentials after refresh attempt: ${credentialError.message}`);
		}
		
		// --- Step 3: Extract the access token from the refreshed credentials ---
		LoggerProxy.debug('OAuth2Token: Retrieved credentials after potential refresh, checking for access token');

		let accessToken: string | undefined;
		if (!refreshedCredentials) {
			// This might happen if the initial fetch in the catch block also failed.
			throw new NodeOperationError(this.getNode(), 'Failed to retrieve OAuth2 credentials.');
		}

		// Use the same logic as before, but on refreshedCredentials
		if (refreshedCredentials.accessToken) {
			accessToken = refreshedCredentials.accessToken as string;
		} else if (refreshedCredentials.access_token) {
			accessToken = refreshedCredentials.access_token as string;
		} else if (refreshedCredentials.token) {
			accessToken = refreshedCredentials.token as string;
		} // Add other checks if needed based on observed credential structures
		else if (refreshedCredentials.oauthTokenData) { // Check for nested structure
			const tokenData = refreshedCredentials.oauthTokenData as IDataObject;
			accessToken = (tokenData.access_token || tokenData.accessToken) as string;
		}
		// Add more checks here if you know other ways tokens might be stored in your specific OAuth2 credentials

		// Logging the structure of the fetched credentials
		LoggerProxy.debug('OAuth2Token: Credential structure after potential refresh', {
			// Avoid logging sensitive values directly
			credKeys: Object.keys(refreshedCredentials),
			hasOAuthTokenData: !!refreshedCredentials.oauthTokenData,
			tokenFound: !!accessToken,
			hasTokenUrl: !!(refreshedCredentials.tokenUrl || (refreshedCredentials.auth as IDataObject)?.oauth_token_url),
		});

		// Check if token was found
		if (!accessToken) {
			// Provide a more informative error message
			throw new NodeOperationError(this.getNode(), 'No access token found in the OAuth2 credentials structure even after refresh attempt. Verify credential setup, authorization, and structure (e.g., check if token is nested under `oauthTokenData`).');
		}

		LoggerProxy.debug('OAuth2Token: Successfully retrieved potentially refreshed access token.', {
			tokenPreview: typeof accessToken === 'string' ?
				`<span class="math-inline">\{accessToken\.substring\(0, 4\)\}\.\.\.</span>{accessToken.substring(accessToken.length - 4)}` :
				'<non-string token>'
		});
		// --- Step 4: Add token to output items ---
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const item = items[itemIndex];

				// Create a new object for the output item
				// IMPORTANT: Clone json data to avoid modifying the input item for subsequent nodes/loops
				const newItem: INodeExecutionData = {
					json: JSON.parse(JSON.stringify(item.json)), // Deep clone is safest
					// You might want to shallow clone binary if performance is critical and you know you won't modify nested properties
					binary: item.binary ? { ...item.binary } : undefined,
					pairedItem: { item: itemIndex }, // Link item for error reporting / context
				};

				// Add the access token to the cloned json data
				newItem.json[accessTokenFieldName] = accessToken;

				// Add the processed item to the return array
				returnItems.push(newItem);

				LoggerProxy.debug('OAuth2Token: Added access token to item', { itemIndex });

			} catch (error: Error | any) {
				// Keep your existing error handling for the loop
				if (this.continueOnFail()) {
					returnItems.push({
						json: { error: error.message || 'Unknown error processing item' },
						pairedItem: { item: itemIndex }
					});
					LoggerProxy.warn(`OAuth2Token: Error processing item ${itemIndex}, continuing.`, { error: error.toString() });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error.message || 'Error processing item', {
						itemIndex,
						message: error.toString(), // Add original error string for context
					});
				}
			}
		}

		LoggerProxy.debug('OAuth2Token: Execution completed successfully', {
			itemCount: returnItems.length
		});

		// Return the array of processed items wrapped in an outer array
		return [returnItems]; // <-- Make sure you return [returnItems]
	}
} 