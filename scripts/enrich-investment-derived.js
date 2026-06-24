/**
 * KPIs de inversión derivados del payload (CPL proxy, concentración HHI, alertas).
 */

const INVESTMENT_ALERT_METRICS = new Set(['hhi', 'cpl_global', 'cpl_wow']);

function round(val, decimals = 2) {
    if (val == null || !Number.isFinite(val)) return null;
    const factor = Math.pow(10, decimals);
    return Math.round(val * factor) / factor;
}

function resolveHhiThresholds(data) {
    const cfg = data?.meta?.config || {};
    return {
        warning: Number(cfg.hhi_warning) || 0.15,
        critical: Number(cfg.hhi_critical) || 0.25,
    };
}

function classifyEfficiency(cplProxy, globalCpl) {
    if (!Number.isFinite(cplProxy) || !Number.isFinite(globalCpl) || globalCpl <= 0) {
        return 'avg';
    }
    const band = globalCpl * 0.05;
    if (cplProxy < globalCpl - band) return 'below_avg';
    if (cplProxy > globalCpl + band) return 'above_avg';
    return 'avg';
}

function classifyHhiRisk(hhi, thresholds) {
    if (!Number.isFinite(hhi)) return 'unknown';
    if (hhi >= thresholds.critical) return 'high';
    if (hhi >= thresholds.warning) return 'moderate';
    return 'ok';
}

function buildConcentration(inv, thresholds) {
    const hhiVal = Number(inv.hhi?.index ?? inv.mmm?.hhi_index);
    const campaigns = Array.isArray(inv.campaigns) ? inv.campaigns : [];

    if (!campaigns.length) {
        return { available: false, reason: 'no_campaigns' };
    }

    const sorted = [...campaigns].sort(
        (a, b) => (Number(b.pct_of_total) || 0) - (Number(a.pct_of_total) || 0)
    );
    const top3Pct = sorted
        .slice(0, 3)
        .reduce((sum, c) => sum + (Number(c.pct_of_total) || 0), 0);

    const top = sorted[0] || {};

    return {
        available: true,
        hhi: Number.isFinite(hhiVal) ? round(hhiVal, 4) : null,
        label: inv.hhi?.label || inv.mmm?.hhi_label || '',
        top3_pct: round(top3Pct, 2),
        top_campaign: {
            name: top.name || '',
            pct_of_total: round(Number(top.pct_of_total), 2),
            spend: round(Number(top.spend), 2),
        },
        risk: classifyHhiRisk(hhiVal, thresholds),
    };
}

function enrichCampaigns(campaigns, totalLeads, globalCpl) {
    return (campaigns || []).map((c) => {
        const pct = Number(c.pct_of_total) || 0;
        const spend = Number(c.spend) || 0;
        const leadsAllocated = totalLeads > 0
            ? Math.max(1, Math.round(totalLeads * pct / 100))
            : 1;
        const cplProxy = spend / leadsAllocated;
        const cplVsGlobal = Number.isFinite(globalCpl) ? round(cplProxy - globalCpl, 2) : null;

        return {
            name: c.name || '',
            spend: round(spend, 2),
            pct_of_total: round(pct, 2),
            source: c.source || '',
            reporting_days: c.records != null ? Number(c.records) : null,
            leads_allocated: leadsAllocated,
            cpl_proxy: round(cplProxy, 2),
            cpl_vs_global: cplVsGlobal,
            efficiency: classifyEfficiency(cplProxy, globalCpl),
        };
    });
}

function filterInvestmentAlerts(alerts) {
    if (!Array.isArray(alerts)) return [];
    return alerts.filter((a) => {
        const metric = String(a?.metric || a?.id || '').toLowerCase();
        return INVESTMENT_ALERT_METRICS.has(metric)
            || metric.includes('hhi')
            || metric.includes('cpl');
    });
}

function enrichInvestmentDerived(data) {
    if (!data || typeof data !== 'object') return data;

    const inv = data.investment || {};
    const economics = data.derived?.economics || {};
    const totalLeads = Number(data.operations?.total_leads) || 0;
    const globalCpl = Number(inv.cpl?.global_cpl);
    const thresholds = resolveHhiThresholds(data);
    const campaigns = Array.isArray(inv.campaigns) ? inv.campaigns : [];

    inv.derived = {
        economics: {
            global_cpl: Number.isFinite(globalCpl) ? round(globalCpl, 2) : null,
            roas_proxy: economics.roas_proxy != null ? Number(economics.roas_proxy) : null,
            breakeven_cpl_gap: economics.breakeven_cpl_gap != null
                ? Number(economics.breakeven_cpl_gap)
                : null,
            revenue_estimated: economics.revenue_estimated != null
                ? Number(economics.revenue_estimated)
                : null,
        },
        concentration: buildConcentration(inv, thresholds),
        campaigns: enrichCampaigns(campaigns, totalLeads, globalCpl),
        investment_alerts: filterInvestmentAlerts(data.system?.alerts),
    };

    data.investment = inv;
    return data;
}

module.exports = {
    enrichInvestmentDerived,
    enrichCampaigns,
    buildConcentration,
    filterInvestmentAlerts,
    classifyEfficiency,
};
