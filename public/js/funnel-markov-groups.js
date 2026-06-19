function isResidualMarkovState(rawState) {
    const raw = String(rawState || '').trim();
    return raw.toLowerCase() === 'abierto';
}

function filterVisibleMarkovRows(rows) {
    return (rows || []).filter((row) => !isResidualMarkovState(row.rawState ?? row.state));
}

const MARKOV_RAW_LABELS = {
    'Abierto (Open)': 'Abierto (Open)',
    Abierto: 'Abierto',
};

function formatMarkovStateLabel(rawState, cleanFn) {
    const raw = String(rawState || '').trim();
    if (!raw) return '—';
    if (MARKOV_RAW_LABELS[raw]) return MARKOV_RAW_LABELS[raw];
    if (/^abierto\s*\(open\)$/i.test(raw)) return 'Abierto (Open)';
    return cleanFn(raw);
}

const MARKOV_GROUP_LABELS = {
    'pre-cierre': 'Pre-cierre',
    contacto: 'Contacto',
    'leads-nuevos': 'Leads nuevos',
    'en-llamada': 'En llamada',
    recuperacion: 'Recuperación',
    reactivacion: 'Reactivación',
    consultas: 'Consultas',
    abierto: 'Abierto',
    operaciones: 'Operaciones',
    otros: 'Otros',
};

const MARKOV_GROUP_ORDER = [
    'pre-cierre',
    'contacto',
    'leads-nuevos',
    'en-llamada',
    'recuperacion',
    'reactivacion',
    'consultas',
    'abierto',
    'operaciones',
    'otros',
];

function resolveMarkovGroup(rawState, cleanedState) {
    const s = String(rawState || cleanedState || '').toLowerCase();
    const c = String(cleanedState || '').toLowerCase();

    if (/pre\s*closed|pre-cierre|pre closed|preclosed|pre-cerrado|pre closed/.test(s) || c.includes('pre-cierre') || c.includes('oportunidad de pre-cierre')) {
        return 'pre-cierre';
    }
    if (/recovery|recuperaci/.test(s) || c.includes('recuperación') || c.includes('recup.')) {
        return 'recuperacion';
    }
    if (/reactivaci/.test(s) || c.includes('reactivación')) {
        return 'reactivacion';
    }
    if (/consult booked|consulta agendada|cita en/.test(s) || c.includes('consulta agendada') || c.includes('cita')) {
        return 'consultas';
    }
    if (/new lead|nuevo lead|\bnl |agendado/.test(s) || c.includes('lead nuevo') || c.includes('agendado')) {
        return 'leads-nuevos';
    }
    if (/outreach|contacto|connected|contactado/.test(s) || c.includes('contacto') || c.includes('contactado')) {
        return 'contacto';
    }
    if (/en llamada|on call|in call/.test(s) || c === 'en llamada') {
        return 'en-llamada';
    }
    if (/detenidos|transfer to/.test(s) || c.includes('detenidos') || c.includes('transferido')) {
        return 'operaciones';
    }
    if ((/\babierto\b|\bopen\b/.test(s) || c === 'abierto') && !/pre/.test(s)) {
        return 'abierto';
    }
    return 'otros';
}

function getMarkovGroupOptions(rows) {
    const counts = new Map();
    (rows || []).forEach((row) => {
        const g = row.group || 'otros';
        counts.set(g, (counts.get(g) || 0) + 1);
    });

    const options = [{ id: 'all', label: 'Todos', count: rows.length }];
    MARKOV_GROUP_ORDER.forEach((id) => {
        if (counts.has(id)) {
            options.push({
                id,
                label: MARKOV_GROUP_LABELS[id] || id,
                count: counts.get(id),
            });
        }
    });
    return options;
}

function filterMarkovByGroup(rows, groupId) {
    if (!groupId || groupId === 'all') return rows;
    return rows.filter((row) => row.group === groupId);
}
