require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Supabase Client (service role for server-side signed URL generation) ──
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;
const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_BUCKET || !SUPABASE_JWT_SECRET) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_BUCKET) console.error('   - SUPABASE_BUCKET');
  if (!SUPABASE_JWT_SECRET) console.error('   - SUPABASE_JWT_SECRET');
  process.exit(1);
}

console.log(`✅ Supabase config loaded — bucket: ${SUPABASE_BUCKET}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ── CORS — allow requests from the static site ──
app.use(cors({
  origin: true,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Auth middleware — verifies Supabase JWT access token ──
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
    req.user = decoded; // { sub, email, aud, role, ... }
    next();
  } catch (err) {
    console.error('[Auth] JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ── GET /api/health ── (public, for debugging)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    bucket: SUPABASE_BUCKET,
    hasUrl: !!SUPABASE_URL,
    hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
    hasJwtSecret: !!SUPABASE_JWT_SECRET,
  });
});

// ── GET /api/photos ── (protected — requires valid JWT)
app.get('/api/photos', requireAuth, async (req, res) => {
  try {
    console.log(`[API] Authenticated user: ${req.user.email || req.user.sub}`);
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

    const folders = objects.filter(o => !o.id && !o.metadata);
    const files = objects.filter(o => o.id || o.metadata);

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

    // Generate signed URLs — 60 second expiry for security
    const EXPIRES_IN = 60;
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
    console.log(`[API] Returning ${validPhotos.length} photos (signed URLs expire in ${EXPIRES_IN}s)`);
    res.json({ photos: validPhotos });

  } catch (err) {
    console.error('[API] Unexpected error:', err);
    res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`📸 Photo API running at http://localhost:${PORT}`);
});
