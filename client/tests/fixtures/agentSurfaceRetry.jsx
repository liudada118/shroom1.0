import React from 'react';
import { createRoot } from 'react-dom/client';
import AgentRendererHost from '../../src/extensions/display-system/AgentRendererHost.jsx';

const identity = { displaySystemId: 'fixture', sensorId: 'mat', channelId: 'fixture:mat', outputChannel: 'mat' };

/** 只测试图表沙箱恢复；不连接串口、不执行算法、不写用户配置。 */
function RetryFixture() {
  return ['breath', 'cop'].map((id) => (
    <section key={id} data-test-surface={id}>
      <AgentRendererHost
        rendererId="agent:retry"
        app={{ appId: 'retry', entryUrl: 'http://127.0.0.1:19245/api/agent-apps/retry/files/' + id + '.html', height: 200 }}
        surface="chart" surfaceId={'agent-chart:retry:' + id}
        widgetId={id} identity={identity}
        values={Array(1024).fill(1)} rawValues={Array(1028).fill(2)}
        matrix={{ rows: 32, cols: 32 }}
        algorithmMetrics={{ respirationSignal: -0.3, copX: 4, copY: 5 }}
      />
    </section>
  ));
}

createRoot(document.getElementById('root')).render(<RetryFixture />);
