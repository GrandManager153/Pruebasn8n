/**
 * Añade meta.config al DashboardPayloadBuilder y revenue_per_conversion a RuntimeConfig.
 */
const fs = require('fs');
const path = require('path');

const WORKFLOW_FILE = path.join(__dirname, '..', 'Mkt_BI_IA_v7 (2).json');

function patchRuntimeConfig(jsCode) {
  if (jsCode.includes('revenue_per_conversion:')) return jsCode;
  return jsCode.replace(
    'ticket_promedio: 500,',
    "ticket_promedio: 500,\n    revenue_per_conversion: 1200,\n    conversion_target: 'Consult Booked',"
  );
}

function patchDashboardPayloadBuilder(jsCode) {
  if (jsCode.includes('meta.config')) return jsCode;

  const cfgBlock = `
let cfg = {};
try { cfg = $('RuntimeConfig').first().json; } catch (e) { cfg = {}; }
`;

  if (!jsCode.includes('const cpl = facts.cpl_analysis')) {
    throw new Error('DashboardPayloadBuilder structure unexpected');
  }

  const withCfg = jsCode.replace(
    'const cpl = facts.cpl_analysis || {};',
    `const cpl = facts.cpl_analysis || {};\n${cfgBlock}`
  );

  return withCfg.replace(
    "execution_id: 'exec_' + Date.now()\n  },",
    `execution_id: 'exec_' + Date.now(),\n    config: {\n      ticket_promedio: cfg.ticket_promedio || 500,\n      revenue_per_conversion: cfg.revenue_per_conversion || 1200,\n      conversion_target: cfg.conversion_target || 'Consult Booked',\n      trap_threshold_leads: cfg.trap_threshold_leads || 200,\n      overcontact_max: cfg.overcontact_max || 7,\n      lookback_days: cfg.lookback_days || 42,\n      leak_warning_pct: cfg.leak_warning_pct || 10,\n      leak_critical_pct: cfg.leak_critical_pct || 25\n    }\n  },`
  );
}

function patchWorkflow(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn('Skip (not found):', filePath);
    return;
  }

  const workflow = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let changed = 0;

  for (const node of workflow.nodes || []) {
    if (node.name === 'RuntimeConfig' && node.parameters?.jsCode) {
      const next = patchRuntimeConfig(node.parameters.jsCode);
      if (next !== node.parameters.jsCode) {
        node.parameters.jsCode = next;
        changed++;
      }
    }
    if (node.name === 'DashboardPayloadBuilder' && node.parameters?.jsCode) {
      const next = patchDashboardPayloadBuilder(node.parameters.jsCode);
      if (next !== node.parameters.jsCode) {
        node.parameters.jsCode = next;
        changed++;
      }
    }
  }

  if (changed > 0) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log('Patched', path.basename(filePath), `(${changed} nodes)`);
  } else {
    console.log('Already patched:', path.basename(filePath));
  }
}

patchWorkflow(WORKFLOW_FILE);
