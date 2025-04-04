import { INodeType, INodeTypeDescription, ICredentialType } from 'n8n-workflow';

import { OAuth2Token } from './nodes/OAuth2Token/OAuth2Token.node';

export class OAuth2TokenNode implements INodeType {
	description: INodeTypeDescription = new OAuth2Token().description;
}

export const nodeTypes = [
	OAuth2TokenNode,
];

export const credentialTypes = []; 