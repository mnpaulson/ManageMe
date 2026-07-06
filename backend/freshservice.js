import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const apiKey = process.env.FRESHSERVICE_API_KEY;
export let domain = process.env.FRESHSERVICE_DOMAIN || '';
if (domain.startsWith('https://')) {
  domain = domain.substring(8);
} else if (domain.startsWith('http://')) {
  domain = domain.substring(7);
}
if (domain.endsWith('/')) {
  domain = domain.slice(0, -1);
}

export function isEnabled() {
  return !!(apiKey && domain);
}

function getHeaders() {
  const auth = Buffer.from(`${apiKey}:X`).toString('base64');
  return {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };
}

export async function getGroupIdByName(groupName) {
  if (process.env.FRESHSERVICE_GROUP_ID) {
    console.log(`[Freshservice] Using group ID from env: ${process.env.FRESHSERVICE_GROUP_ID}`);
    return parseInt(process.env.FRESHSERVICE_GROUP_ID, 10);
  }

  if (!isEnabled()) throw new Error('Freshservice integration is disabled');
  let page = 1;
  let hasMore = true;
  const targetLower = groupName.toLowerCase().trim();

  while (hasMore) {
    const url = `https://${domain}/api/v2/groups?page=${page}&per_page=100`;
    console.log(`[Freshservice] Fetching groups page ${page}...`);
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch groups: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const groups = data.groups || [];

    // Log group names on this page for troubleshooting
    console.log(`[Freshservice] Page ${page} groups:`, groups.map(g => g.name));

    const matchedGroup = groups.find(g => g.name && g.name.toLowerCase().trim() === targetLower);
    if (matchedGroup) {
      console.log(`[Freshservice] Matched group "${groupName}" to ID: ${matchedGroup.id}`);
      return matchedGroup.id;
    }

    if (groups.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }
  console.warn(`[Freshservice] Warning: Could not find any group matching "${groupName}"`);
  return null;
}

export async function getCustomFieldNameByLabel(labelName) {
  if (!isEnabled()) throw new Error('Freshservice integration is disabled');
  const url = `https://${domain}/api/v2/ticket_form_fields`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ticket form fields: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  // Filter for matching label
  const fields = data.ticket_fields || [];
  const matched = fields.find(f => f.label && f.label.toLowerCase() === labelName.toLowerCase());
  return matched ? matched.name : null;
}

export async function getAgentMe() {
  if (!isEnabled()) throw new Error('Freshservice integration is disabled');
  const url = `https://${domain}/api/v2/agents/me`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch agent profile: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.agent;
}

export async function getAssignedTickets(agentId) {
  if (!isEnabled()) throw new Error('Freshservice integration is disabled');
  const queryStr = `"agent_id:${agentId} AND (status:2 OR status:3)"`;
  const url = `https://${domain}/api/v2/tickets/filter?query=${encodeURIComponent(queryStr)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch assigned tickets: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.tickets || [];
}

export async function createTicket(subject, description, agentEmail, agentId, requesterEmail) {
  if (!isEnabled()) throw new Error('Freshservice integration is disabled');

  // 1. Resolve group ID for 'Enterprise Systems Team'
  let groupId = null;
  try {
    groupId = await getGroupIdByName('Enterprise Systems Team');
  } catch (err) {
    console.error('Failed to resolve group ID for Enterprise Systems Team:', err);
  }

  // 2. Resolve custom field name for 'Work Type'
  let workTypeField = null;
  try {
    workTypeField = await getCustomFieldNameByLabel('Work Type');
  } catch (err) {
    console.error('Failed to resolve custom field name for Work Type:', err);
  }

  const url = `https://${domain}/api/v2/tickets`;
  const payload = {
    subject,
    description: description || 'No description provided',
    email: requesterEmail || agentEmail,
    responder_id: agentId,
    status: 2, // Open
    priority: 1, // Low
    category: 'Enterprise Systems',
    sub_category: 'CRM/Salesforce',
    source: 15 // MS Teams
  };

  if (groupId) {
    payload.group_id = groupId;
  }

  if (workTypeField) {
    payload.custom_fields = {
      [workTypeField]: 'Add / Move / Change'
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Failed to create ticket: ${response.status} ${response.statusText} - ${errBody}`);
  }
  const data = await response.json();
  return data.ticket;
}

export async function updateTicket(ticketId, status, subject, description, resolutionNotes) {
  if (!isEnabled()) throw new Error('Freshservice integration is disabled');
  const url = `https://${domain}/api/v2/tickets/${ticketId}`;
  const payload = {
    subject,
    description: description || 'No description provided',
    status
  };
  if (resolutionNotes) {
    payload.resolution_notes = resolutionNotes;
  }
  const response = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Failed to update ticket: ${response.status} ${response.statusText} - ${errBody}`);
  }
  const data = await response.json();
  return data.ticket;
}
