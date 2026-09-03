const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Supabase Client (service role for server-side signed URL generation) ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'birthday-photos';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  console.error('   Copy .env.example to .env and fill in your Supabase credentials.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── Serve static files ──
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  index: 'index.html',
}));

// ── CORS headers for API routes ──
app.use('/api', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ── GET /api/photos ──
// Lists all objects in the Supabase Storage bucket and returns
// short-lived signed URLs so the bucket stays private.
app.get('/api/photos', async (req, res) => {
  try {
    // 1. List all objects in the bucket (recursive to get subfolders)
    const { data: objects, error: listError } = await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
        search: '',
      });

    if (listError) {
      console.error('Supabase list error:', listError);
      return res.status(500).json({ error: 'Failed to list photos.' });
    }

    if (!objects || objects.length === 0) {
      return res.json({ photos: [] });
    }

    // 2. Filter to only image files
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
    const images = objects.filter(obj => {
      const name = obj.name.toLowerCase();
      return imageExts.some(ext => name.endsWith(ext));
    });

    if (images.length === 0) {
      return res.json({ photos: [] });
    }

    // 3. Generate signed URLs (valid for 1 hour)
    const EXPIRES_IN = 3600; // 1 hour
    const photos = await Promise.all(
      images.map(async (img) => {
        const { data, error } = await supabase
          .storage
          .from(SUPABASE_BUCKET)
          .createSignedUrl(img.name, EXPIRES_IN);

        if (error) {
          console.error(`Signed URL error for ${img.name}:`, error);
          return null;
        }

        // Use the filename (without extension) as the caption
        const caption = img.name
          .replace(/\.[^/.]+$/, '')        // remove extension
          .replace(/[-_]/g, ' ')            // underscores/hyphens to spaces
          .replace(/\b\w/g, c => c.toUpperCase()); // title case

        return {
          url: data.signedUrl,
          name: img.name,
          caption,
          created_at: img.created_at,
        };
      })
    );

    // 4. Filter out any nulls (failed signed URLs) and return
    const validPhotos = photos.filter(Boolean);
    res.json({ photos: validPhotos });

  } catch (err) {
    console.error('Unexpected error in /api/photos:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Fallback: serve index.html for SPA-like routing ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start server ──
app.listen(PORT, () => {
  console.log(`🎂 Birthday website running at http://localhost:${PORT}`);
  console.log(`📦 Supabase bucket: ${SUPABASE_BUCKET}`);
});
