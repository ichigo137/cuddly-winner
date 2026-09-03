require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Supabase Client ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_BUCKET) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_BUCKET) console.error('   - SUPABASE_BUCKET');
  process.exit(1);
}

console.log(`✅ Supabase config loaded — bucket: ${SUPABASE_BUCKET}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── CORS — allow requests from the static site ──
app.use(cors({
  origin: true, // reflect the requesting origin (works for both local and production)
  methods: ['GET', 'OPTIONS'],
}));

// ── GET /api/health ──
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    bucket: SUPABASE_BUCKET,
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
  });
});

// ── GET /api/photos ──
app.get('/api/photos', async (req, res) => {
  try {
    console.log(`[API] Listing from bucket: ${SUPABASE_BUCKET}`);

    const { data: objects, error: listError } = await supabase
      .storage
      .from(SUPABASE_BUCKET)
      .list('', {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      console.error('[API] Supabase list error:', JSON.stringify(listError));
      return res.status(500).json({
        error: 'Failed to list photos.',
        details: listError.message || String(listError),
      });
    }

    if (!objects || objects.length === 0) {
      return res.json({ photos: [] });
    }

    // Filter to image files
    const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.tiff'];
    let allImages = [];

    // Separate folders from files
    const folders = objects.filter(o => !o.id && !o.metadata);
    const files = objects.filter(o => o.id || o.metadata);

    // Root-level images
    const rootImages = files.filter(obj => {
      const name = obj.name.toLowerCase();
      return imageExts.some(ext => name.endsWith(ext));
    });
    allImages.push(...rootImages);

    // Recurse into subfolders (one level deep)
    for (const folder of folders) {
      console.log(`[API] Checking subfolder: ${folder.name}`);
      const { data: subObjects, error: subError } = await supabase
        .storage
        .from(SUPABASE_BUCKET)
        .list(folder.name, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (!subError && subObjects) {
        const subImages = subObjects.filter(obj => {
          const name = obj.name.toLowerCase();
          return imageExts.some(ext => name.endsWith(ext));
        });
        subImages.forEach(img => { img._folder = folder.name; });
        allImages.push(...subImages);
      }
    }

    console.log(`[API] Total images: ${allImages.length}`);

    if (allImages.length === 0) {
      return res.json({ photos: [] });
    }

    // Generate signed URLs (valid for 1 hour)
    const EXPIRES_IN = 3600;
    const photos = await Promise.all(
      allImages.map(async (img) => {
        const filePath = img._folder ? `${img._folder}/${img.name}` : img.name;

        const { data, error } = await supabase
          .storage
          .from(SUPABASE_BUCKET)
          .createSignedUrl(filePath, EXPIRES_IN);

        if (error) {
          console.error(`[API] Signed URL error for ${filePath}:`, JSON.stringify(error));
          return null;
        }

        const caption = img.name
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());

        return {
          url: data.signedUrl,
          name: img.name,
          caption,
          created_at: img.created_at,
        };
      })
    );

    const validPhotos = photos.filter(Boolean);
    console.log(`[API] Returning ${validPhotos.length} photos`);
    res.json({ photos: validPhotos });

  } catch (err) {
    console.error('[API] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`📸 Photo API running at http://localhost:${PORT}`);
});
