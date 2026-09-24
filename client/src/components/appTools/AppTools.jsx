import UpdateNotifier from '../updater/UpdateNotifier';
import AgentWorkspace from '../../features/agent/AgentWorkspace';
import './AppTools.css';

/** 集中排列应用级入口；弹窗仍由各组件管理，不参与按钮布局。 */
export default function AppTools() {
  return <div className="shroom-app-tools" role="group" aria-label="应用工具">
    <UpdateNotifier />
    <div id="shroom-app-feedback" className="shroom-app-feedback-slot" />
    <AgentWorkspace />
  </div>;
}
