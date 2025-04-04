# n8n-nodes-oauth2-token

This is an n8n community node that retrieves a valid OAuth2 access token from credentials and adds it to the output data.

## Installation

Follow these instructions to install this node in your n8n instance:

### Community Node Installation (Recommended)

1. Open your n8n instance
2. Go to **Settings > Community Nodes**
3. Select **Install**
4. Enter `n8n-nodes-oauth2-token` in **Enter npm package name**
5. Agree to the disclaimer
6. Select **Install**

### Manual Installation

To install this node manually:

```bash
# In your n8n installation directory
cd ~/.n8n/custom
npm install n8n-nodes-oauth2-token
```

## Node Features

### OAuth2 Token

This node allows you to:
- Select an OAuth2 credential from your n8n instance
- Choose a field name where the access token will be inserted
- Retrieve a valid access token from the selected credential
- Combine the token with input data

#### Example:

If your input data is:
```json
{
  "foo": 1
}
```

And you configure the node to output the token in the field "accessToken", the output will be:
```json
{
  "foo": 1,
  "accessToken": "your-oauth2-access-token-here"
}
```

The node uses the built-in OAuth2 credential management of n8n, so token refreshing is handled automatically when needed.

## Development

To develop and test this node locally:

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the code: `npm run build`
4. Link to your local n8n instance: `npm link`
5. In your n8n installation, link to this package: `cd ~/.n8n/custom && npm link n8n-nodes-oauth2-token`

## License

[MIT](LICENSE.md) 