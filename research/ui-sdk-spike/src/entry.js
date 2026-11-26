// One bundle: the agent bridge must share the same @ui-sdk/core instance as the components.
import { createAgent } from "@ui-sdk/web/agent"
window.uiAgent = createAgent()
import "./mero-tree.js"
import "./mero-grid.js"
import "./mero-asset-picker.js"
