import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { resolveImageUrl } from '../../utils/imageUrl';

const STATUS_OPTIONS = ['pending', 'approved_auction', 'approved_exhibit', 'not_for_sale', 'rejected'];
const STATUS_LABELS = { pending: 'Pending', approved_auction: 'Auction', approved_exhibit: 'Exhibit', not_for_sale: 'Not for Sale', rejected: 'Rejected' };

export default function ArtworkManager() {
  const [artworks, setArtworks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ status: '', item_type: '', min_price: '', max_price: '' });
  const [editArtwork, setEditArtwork] = useState(null);
  const [selected, setSelected] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [uploading, setUploading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const csvRef = useRef();

  const load = async () => {
    const params = { page, limit: 20 };
    if (filter.status) params.status = filter.status;
    if (filter.item_type) params.item_type = filter.item_type;
    if (filter.min_price !== '') params.min_price = filter.min_price;
    if (filter.max_price !== '') params.max_price = filter.max_price;
    try {
      const res = await api.get('/admin/artworks', { params });
      setArtworks(res.data.artworks || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, [page, filter]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/artworks/${id}`, { status });
      toast.success(`Status updated to ${STATUS_LABELS[status]}`);
      load();
    } catch { toast.error('Failed to update status'); }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selected.length === 0) return;
    try {
      await Promise.all(selected.map(id => api.patch(`/artworks/${id}`, { status: bulkStatus })));
      toast.success(`Updated ${selected.length} artworks`);
      setSelected([]); setBulkStatus('');
      load();
    } catch { toast.error('Bulk update failed'); }
  };

  const handleBulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} selected artworks?`)) return;

    try {
      await Promise.all(selected.map(id => api.delete(`/artworks/${id}`)));
      toast.success(`Deleted ${selected.length} artworks`);
      setSelected([]);
      load();
    } catch {
      toast.error('Bulk delete failed');
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('csv', file);
      const res = await api.post('/admin/import-csv', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(`Imported: ${res.data.imported}, Skipped: ${res.data.skipped}`);
      load();
    } catch { toast.error('CSV import failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond', fontSize: 34 }}>Artwork Management</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>+ Add Artwork</button>
          <input ref={csvRef} type="file" accept=".csv" onChange={handleCSVImport} style={{ display: 'none' }} />
          <button className="btn btn-outline" onClick={() => csvRef.current.click()} disabled={uploading}>
            {uploading ? 'Importing...' : '📥 Import CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} style={{ width: 'auto' }}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filter.item_type} onChange={e => setFilter(f => ({ ...f, item_type: e.target.value }))} style={{ width: 'auto' }}>
          <option value="">All Types</option>
          <option value="Artwork">Artwork</option>
          <option value="Sculpture">Sculpture</option>
          <option value="Stall">Stall</option>
        </select>
        <input
          type="number"
          placeholder="Min ₹"
          value={filter.min_price}
          onChange={e => setFilter(f => ({ ...f, min_price: e.target.value }))}
          style={{ width: 110 }}
        />
        <input
          type="number"
          placeholder="Max ₹"
          value={filter.max_price}
          onChange={e => setFilter(f => ({ ...f, max_price: e.target.value }))}
          style={{ width: 110 }}
        />
        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.length} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)} style={{ width: 'auto' }}>
              <option value="">Change status to...</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <button className="btn btn-primary" onClick={handleBulkStatus} disabled={!bulkStatus} style={{ padding: '8px 14px', fontSize: 13 }}>Apply</button>
            <button className="btn btn-danger" onClick={handleBulkDelete} style={{ padding: '8px 14px', fontSize: 13 }}>Delete</button>
          </div>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 12px', width: 32 }}>
                  <input type="checkbox"
                    onChange={e => setSelected(e.target.checked ? artworks.map(a => a.id) : [])}
                    checked={selected.length === artworks.length && artworks.length > 0}
                  />
                </th>
                {['ID', 'Title', 'Artist', 'Type', 'Status', 'Base Price', 'Current Bid', 'Bids', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artworks.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid var(--border)', background: selected.includes(a.id) ? 'rgba(200,150,42,0.05)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <input type="checkbox" checked={selected.includes(a.id)}
                      onChange={e => setSelected(p => e.target.checked ? [...p, a.id] : p.filter(x => x !== a.id))}
                    />
                  </td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{a.id}</td>
                  <td style={{ padding: '10px 12px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || 'Untitled'}</td>
                  <td style={{ padding: '10px 12px' }}>{a.artist_name}</td>
                  <td style={{ padding: '10px 12px' }}>{a.item_type || '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <select value={a.status} onChange={e => updateStatus(a.id, e.target.value)} style={{ width: 'auto', fontSize: 12, padding: '4px 8px' }}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '10px 12px' }}>{a.base_price ? `₹${Number(a.base_price).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--accent-warm)' }}>{a.current_highest_bid ? `₹${Number(a.current_highest_bid).toLocaleString('en-IN')}` : '—'}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{a.total_bids || 0}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <button className="btn btn-outline" onClick={() => setEditArtwork(a)} style={{ padding: '4px 10px', fontSize: 12 }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
        <span style={{ color: 'var(--text-muted)' }}>Showing {artworks.length} of {total}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px' }}>Prev</button>
          <button className="btn btn-outline" disabled={artworks.length < 20} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px' }}>Next</button>
        </div>
      </div>

      {editArtwork && (
        <EditArtworkModal artwork={editArtwork} onClose={() => { setEditArtwork(null); load(); }} />
      )}

      {createOpen && (
        <CreateArtworkModal onClose={() => { setCreateOpen(false); load(); }} />
      )}
    </div>
  );
}

function CreateArtworkModal({ onClose }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    artist_name: '',
    artist_email: '',
    artist_roll: '',
    artist_contact: '',
    base_price: '',
    item_type: 'Artwork',
    auction_or_exhibit: 'Auction',
    medium: '',
    surface_used: '',
    dimensions: '',
    is_framed: false,
    status: 'pending',
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const createArtwork = async () => {
    if (!form.artist_name.trim()) {
      toast.error('Artist name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        base_price: form.base_price === '' ? null : Number(form.base_price),
      };

      const res = await api.post('/artworks', payload);
      const artworkId = res.data.id;

      if (files.length > 0) {
        const formData = new FormData();
        [...files].forEach(file => formData.append('images', file));
        await api.post(`/upload/artwork/${artworkId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      toast.success('Artwork created');
      onClose();
    } catch {
      toast.error('Failed to create artwork');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div className="card" style={{ padding: 24, maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 28 }}>Add New Artwork</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Title', 'title'],
            ['Artist Name *', 'artist_name'],
            ['Artist Email', 'artist_email'],
            ['Artist Roll', 'artist_roll'],
            ['Artist Contact', 'artist_contact'],
            ['Base Price', 'base_price'],
            ['Medium', 'medium'],
            ['Surface', 'surface_used'],
            ['Dimensions', 'dimensions'],
          ].map(([label, key]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Type</label>
            <select value={form.item_type} onChange={e => setForm(f => ({ ...f, item_type: e.target.value }))}>
              <option value="Artwork">Artwork</option>
              <option value="Sculpture">Sculpture</option>
              <option value="Stall">Stall</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mode</label>
            <select value={form.auction_or_exhibit} onChange={e => setForm(f => ({ ...f, auction_or_exhibit: e.target.value }))}>
              <option value="Auction">Auction</option>
              <option value="Exhibit">Exhibit</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Framed</label>
            <select value={form.is_framed ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, is_framed: e.target.value === 'yes' }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Upload Images</label>
          <input type="file" accept="image/*" multiple onChange={e => setFiles([...e.target.files])} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={createArtwork} disabled={saving}>{saving ? 'Creating...' : 'Create Artwork'}</button>
        </div>
      </div>
    </div>
  );
}

function EditArtworkModal({ artwork, onClose }) {
  const [form, setForm] = useState({
    title: artwork.title || '', description: artwork.description || '',
    base_price: artwork.base_price || '', artist_name: artwork.artist_name || '',
    artist_email: artwork.artist_email || '', artist_roll: artwork.artist_roll || '',
    artist_contact: artwork.artist_contact || '', medium: artwork.medium || '',
    surface_used: artwork.surface_used || '', dimensions: artwork.dimensions || '',
    is_framed: artwork.is_framed || false, status: artwork.status || 'pending',
  });
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    api.get(`/artworks/${artwork.id}`)
      .then(res => setImages(res.data.images || []))
      .catch(() => setImages([]));
  }, [artwork.id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/artworks/${artwork.id}`, form);
      toast.success('Artwork updated');
      onClose();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const refreshImages = async () => {
    const res = await api.get(`/artworks/${artwork.id}`);
    setImages(res.data.images || []);
  };

  const uploadImages = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingImages(true);
    try {
      const formData = new FormData();
      [...files].forEach(file => formData.append('images', file));
      await api.post(`/upload/artwork/${artwork.id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Images uploaded');
      await refreshImages();
    } catch {
      toast.error('Image upload failed');
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const setPrimaryImage = async (imageId) => {
    try {
      await api.patch(`/upload/images/${imageId}`, { is_primary: true });
      toast.success('Primary image updated');
      await refreshImages();
    } catch {
      toast.error('Failed to set primary image');
    }
  };

  const deleteImage = async (imageId) => {
    try {
      await api.delete(`/upload/images/${imageId}`);
      toast.success('Image removed');
      await refreshImages();
    } catch {
      toast.error('Failed to delete image');
    }
  };

  const moveImage = async (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;

    const current = images[index];
    const target = images[nextIndex];

    try {
      await Promise.all([
        api.patch(`/upload/images/${current.id}`, { display_order: nextIndex }),
        api.patch(`/upload/images/${target.id}`, { display_order: index }),
      ]);
      await refreshImages();
    } catch {
      toast.error('Failed to reorder images');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
      <div className="card" style={{ padding: 28, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond', fontSize: 24 }}>Edit Artwork #{artwork.id}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['Title', 'title'], ['Artist Name', 'artist_name'], ['Artist Email', 'artist_email'],
            ['Artist Roll', 'artist_roll'], ['Artist Contact', 'artist_contact'], ['Medium', 'medium'],
            ['Surface', 'surface_used'], ['Dimensions', 'dimensions'], ['Base Price', 'base_price'],
          ].map(([label, key]) => (
            <div key={key}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {['pending', 'approved_auction', 'approved_exhibit', 'not_for_sale', 'rejected'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Framed</label>
            <select value={form.is_framed ? 'yes' : 'no'} onChange={e => setForm(f => ({ ...f, is_framed: e.target.value === 'yes' }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
        </div>

        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Images</label>
          <input type="file" accept="image/*" multiple onChange={uploadImages} />
          {uploadingImages && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>Uploading...</p>}
          <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
            {images.map((img, idx) => (
              <div key={img.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <img src={resolveImageUrl(img.image_path)} alt="artwork" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}>{img.image_path}</div>
                <button className="btn btn-outline" onClick={() => moveImage(idx, -1)} style={{ padding: '4px 8px', fontSize: 11 }}>↑</button>
                <button className="btn btn-outline" onClick={() => moveImage(idx, 1)} style={{ padding: '4px 8px', fontSize: 11 }}>↓</button>
                {!img.is_primary && (
                  <button className="btn btn-outline" onClick={() => setPrimaryImage(img.id)} style={{ padding: '4px 8px', fontSize: 11 }}>Primary</button>
                )}
                <button className="btn btn-danger" onClick={() => deleteImage(img.id)} style={{ padding: '4px 8px', fontSize: 11 }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
}
