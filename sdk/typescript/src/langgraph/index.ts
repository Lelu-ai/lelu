/**
 * LangGraph.js integration for the Auth Permission Engine.
 *
 * secureNode wraps any LangGraph.js node and enforces Lelu authorization
 * *before* the node runs. Framework-agnostic — it has no dependency on
 * @langchain/langgraph, so it works with any state-graph shaped as a plain
 * object.
 *
 * @module langgraph
 */
export {
  secureNode,
  wasDenied,
  pendingReview,
  denialReason,
  LeluDeniedError,
  LELU_DENIED_KEY,
  LELU_REVIEW_KEY,
  LELU_REASON_KEY,
} from "./secure-node.js";
export type { SecureNodeOptions, LangGraphNode } from "./secure-node.js";
