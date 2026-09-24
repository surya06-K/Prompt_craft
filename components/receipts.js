'use client'
import { useEffect, useState } from 'react'
import { Icon } from './ui'

const TARGET_BYTES = 450_000

// Phone photos are several MB; shrink to a readable JPEG of a few hundred KB
// before upload so the database stays small and uploads are quick on 4G.
export async function compressImage(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image'))
      el.src = url
    })
    const attempts = [[1600, 0.72], [1280, 0.65], [1024, 0.6], [800, 0.55]]
    let dataUrl = ''
    for (const [maxSide, quality] of attempts) {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff' // transparent PNGs would turn black as JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length * 0.75 <= TARGET_BYTES) break
    }
    return dataUrl
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Editable strip used inside the expense form.
// items: [{ id?, key, preview?, busy?, error? }]
export function ReceiptPicker({ items, onAdd, onRemove, receiptUrl, max = 6 }) {
  const [viewing, setViewing] = useState(null)
  return (
    <div className="thumbs">
      {items.map(r => (
        <div className="thumb" key={r.key}>
          <button type="button" style={{ width: '100%', height: '100%' }} onClick={() => r.id && setViewing(r)} aria-label="View receipt">
            {(r.preview || r.id) && <img src={r.preview || receiptUrl(r.id)} alt="" />}
          </button>
          {r.busy && <div className="thumb-busy"><span className="spinner" /></div>}
          <button type="button" className="thumb-remove" onClick={() => onRemove(r)} aria-label="Remove receipt"><Icon name="x" size={14} /></button>
        </div>
      ))}
      {items.length < max && (
        <label className="thumb-add">
          <Icon name="camera" size={20} />
          Add photo
          <input type="file" accept="image/*" multiple className="sr-only"
            onChange={e => { onAdd([...e.target.files].slice(0, max - items.length)); e.target.value = '' }} />
        </label>
      )}
      {viewing && <Lightbox src={viewing.preview || receiptUrl(viewing.id)} href={receiptUrl(viewing.id)} onClose={() => setViewing(null)} />}
    </div>
  )
}

// Read-only strip for the expense details view.
export function ReceiptGallery({ ids, receiptUrl }) {
  const [viewing, setViewing] = useState(null)
  if (!ids?.length) return null
  return (
    <div className="thumbs">
      {ids.map(id => (
        <button type="button" className="thumb" key={id} onClick={() => setViewing(id)} aria-label="Open receipt photo">
          <img src={receiptUrl(id)} alt="Receipt" loading="lazy" />
        </button>
      ))}
      {viewing && <Lightbox src={receiptUrl(viewing)} href={receiptUrl(viewing)} onClose={() => setViewing(null)} />}
    </div>
  )
}

function Lightbox({ src, href, onClose }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Receipt photo" onClick={onClose}>
      <div className="lightbox-bar" onClick={e => e.stopPropagation()}>
        <a href={href} target="_blank" rel="noreferrer" className="row small"><Icon name="external" size={16} /> Open full size</a>
        <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ color: '#fff' }}><Icon name="x" /></button>
      </div>
      <img src={src} alt="Receipt" />
    </div>
  )
}
