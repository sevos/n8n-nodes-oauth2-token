"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.credentialTypes = exports.nodeTypes = exports.OAuth2TokenNode = void 0;
const OAuth2Token_node_1 = require("./nodes/OAuth2Token/OAuth2Token.node");
class OAuth2TokenNode {
    constructor() {
        this.description = new OAuth2Token_node_1.OAuth2Token().description;
    }
}
exports.OAuth2TokenNode = OAuth2TokenNode;
exports.nodeTypes = [
    OAuth2TokenNode,
];
exports.credentialTypes = [];
