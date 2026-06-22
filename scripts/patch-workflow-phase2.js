/**
 * Fase 2: max_system_capacity en meta.config + meta.narrative_qa en DashboardPayloadBuilder.
 */
const fs = require('fs');
const path = require('path');

const WORKFLOW_FILE = path.join(__dirname, '..', 'Mkt_BI_IA_v7 (2).json');

function patchRuntimeConfig(jsCode) {
    if (jsCode.includes('max_system_capacity:')) return jsCode;
    return jsCode.replace(
        "conversion_target: 'Consult Booked',",
        "conversion_target: 'Consult Booked',\n    max_system_capacity: 4000,"
    );
}

function patchDashboardPayloadBuilder(jsCode) {
    let next = jsCode;

    if (!next.includes('max_system_capacity')) {
        next = next.replace(
            'leak_critical_pct: cfg.leak_critical_pct || 25',
            'leak_critical_pct: cfg.leak_critical_pct || 25,\n      max_system_capacity: cfg.max_system_capacity || 4000'
        );
    }

    if (!next.includes('narrative_qa:')) {
        const narrativeBlock = `,
    narrative_qa: (function() {
      try {
        var qa = $('NarrativeQA').first().json;
        return { passed: qa.passed !== false, issues: qa.issues || [], issue_count: (qa.issues || []).length };
      } catch(e) { return { passed: null, issues: [] }; }
    })()`;

        next = next.replace(
            /max_system_capacity: cfg\.max_system_capacity \|\| 4000\n    \}\n  \},\n  system: \{/,
            `max_system_capacity: cfg.max_system_capacity || 4000\n    }${narrativeBlock}\n  },\n  system: {`
        );
    }

    return next;
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
            const patched = patchRuntimeConfig(node.parameters.jsCode);
            if (patched !== node.parameters.jsCode) {
                node.parameters.jsCode = patched;
                changed++;
            }
        }
        if (node.name === 'DashboardPayloadBuilder' && node.parameters?.jsCode) {
            const patched = patchDashboardPayloadBuilder(node.parameters.jsCode);
            if (patched !== node.parameters.jsCode) {
                node.parameters.jsCode = patched;
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
