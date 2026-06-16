require('dotenv').config();
const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const { createClient } = require('@supabase/supabase-js');

const port = process.env.PORT || 1234;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

// Setup persistence
setPersistence({
  bindState: async (docName, ydoc) => {
    console.log(`Binding state for document: ${docName}`);
    try {
      // Fetch the latest state from the database
      const { data, error } = await supabase
        .from('diagrams')
        .select('content')
        .eq('id', docName)
        .single();

      if (error) {
        console.error(`Error loading diagram ${docName}:`, error.message);
        return;
      }

      if (data && data.content && data.content.source) {
        const text = ydoc.getText('source');
        // Only load if the document is empty
        if (text.toString() === '') {
          text.insert(0, data.content.source);
        }
      }
    } catch (err) {
      console.error(`Failed to bind state for ${docName}`, err);
    }
  },
  writeState: async (docName, ydoc) => {
    console.log(`Writing state for document: ${docName}`);
    try {
      const source = ydoc.getText('source').toString();
      
      // Update only the source field inside the jsonb content
      // We will fetch existing content first to avoid overwriting other fields.
      const { data: existing } = await supabase
        .from('diagrams')
        .select('content')
        .eq('id', docName)
        .single();
        
      const updatedContent = existing && existing.content ? { ...existing.content, source } : { source };

      const { error } = await supabase
        .from('diagrams')
        .update({ content: updatedContent, updated_at: new Date().toISOString() })
        .eq('id', docName);

      if (error) {
        console.error(`Failed to save diagram ${docName} to Supabase:`, error.message);
      } else {
        console.log(`Saved diagram ${docName} successfully.`);
      }
    } catch (err) {
      console.error(`Error writing state for ${docName}`, err);
    }
  }
});

const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' });
  response.end('Isomorph Collaboration Server OK');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (conn, req) => {
  // Extract token from URL or headers if needed for auth
  // e.g. wss://host/diagramId?token=...
  console.log(`New connection from ${req.socket.remoteAddress}`);
  
  // Rate-limiting and connection logic can be extended here
  
  setupWSConnection(conn, req, { gc: true });
});

server.listen(port, () => {
  console.log(`y-websocket listening on port ${port}`);
});
