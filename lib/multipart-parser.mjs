/**
 * Simple multipart/form-data parser for Node.js
 * Parses form data from POST requests
 */

import fs from 'fs';
import path from 'path';

export async function parseMultipartFormData(request, uploadDir = '.tmp') {
  return new Promise((resolve, reject) => {
    const contentType = request.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
    if (!boundaryMatch) {
      reject(new Error('No boundary in Content-Type header'));
      return;
    }

    const boundary = boundaryMatch[1];
    let buffer = Buffer.alloc(0);

    // Collect all chunks
    request.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
    });

    request.on('end', () => {
      try {
        const result = parseBuffer(buffer, boundary, uploadDir);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    request.on('error', reject);
  });
}

function parseBuffer(buffer, boundary, uploadDir) {
  // Ensure upload directory exists
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
  const crlfBuffer = Buffer.from('\r\n');

  const parts = [];
  let currentPos = 0;

  // Skip initial boundary
  let boundaryIndex = buffer.indexOf(boundaryBuffer);
  if (boundaryIndex === -1) {
    throw new Error('No boundary found in buffer');
  }

  currentPos = boundaryIndex + boundaryBuffer.length + 2; // +2 for \r\n

  while (currentPos < buffer.length) {
    // Find next boundary
    boundaryIndex = buffer.indexOf(boundaryBuffer, currentPos);
    if (boundaryIndex === -1) {
      break;
    }

    // Extract part (from current position to next boundary)
    const partBuffer = buffer.slice(currentPos, boundaryIndex);
    const crlfIndex = partBuffer.indexOf(crlfBuffer);

    if (crlfIndex > 0) {
      // Parse headers
      const headerBuffer = partBuffer.slice(0, crlfIndex);
      const headerText = headerBuffer.toString('utf-8');
      const headers = parseHeaders(headerText);

      // Find content start (after empty line)
      let contentStart = crlfIndex + 2;
      let emptyLineIndex = partBuffer.indexOf(Buffer.from('\r\n\r\n'), contentStart);
      if (emptyLineIndex === -1) {
        emptyLineIndex = partBuffer.indexOf(Buffer.from('\n\n'), contentStart);
        if (emptyLineIndex !== -1) {
          contentStart = emptyLineIndex + 2;
        }
      } else {
        contentStart = emptyLineIndex + 4;
      }

      // Extract content
      let content = partBuffer.slice(contentStart);
      
      // Remove trailing CRLF
      if (content.length >= 2 && content[content.length - 2] === 13 && content[content.length - 1] === 10) {
        content = content.slice(0, -2);
      }

      // Save file if it's a file field
      if (headers.filename) {
        const filename = headers.filename;
        const filepath = path.join(uploadDir, filename);
        fs.writeFileSync(filepath, content);
        parts.push({
          name: headers.name || 'file',
          filename,
          filepath,
          mimetype: headers['content-type'] || 'application/octet-stream',
          size: content.length,
        });
      } else if (headers.name) {
        // Regular form field
        parts.push({
          name: headers.name,
          value: content.toString('utf-8'),
        });
      }
    }

    currentPos = boundaryIndex + boundaryBuffer.length + 2;

    // Check for end boundary
    if (buffer.slice(currentPos, currentPos + 2).toString() === '--') {
      break;
    }
  }

  return { parts, fields: parseFields(parts) };
}

function parseHeaders(headerText) {
  const headers = {};
  const lines = headerText.split('\r\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).toLowerCase().trim();
      const value = line.slice(colonIndex + 1).trim();

      if (key === 'content-disposition') {
        // Parse Content-Disposition header
        const parts = value.split(';').map(p => p.trim());
        for (const part of parts) {
          if (part.startsWith('name=')) {
            headers.name = part.slice(5).replace(/^"|"$/g, '');
          }
          if (part.startsWith('filename=')) {
            headers.filename = part.slice(9).replace(/^"|"$/g, '');
          }
        }
      } else if (key === 'content-type') {
        headers['content-type'] = value;
      }
    }
  }

  return headers;
}

function parseFields(parts) {
  const fields = {};
  
  for (const part of parts) {
    if (part.value) {
      fields[part.name] = part.value;
    } else if (part.filepath) {
      fields[part.name] = {
        filename: part.filename,
        filepath: part.filepath,
        mimetype: part.mimetype,
        size: part.size,
      };
    }
  }

  return fields;
}
