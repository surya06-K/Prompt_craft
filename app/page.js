'use client'
import { useState } from 'react'
import styles from './page.module.css'

const ROLES = [
  { label: 'Copywriter',  value: 'an expert copywriter' },
  { label: 'Consultant',  value: 'a business consultant' },
  { label: 'Engineer',    value: 'a software engineer' },
  { label: 'Marketer',    value: 'a marketing strategist' },
  { label: 'Analyst',     value: 'a data analyst' },
  { label: 'Creative',    value: 'a creative director' },
  { label: 'Coach',       value: 'a personal productivity coach' },
  { label: 'Founder',     value: 'a startup founder' },
]

const FORMATS = [
  { label: 'Bullet list',   value: 'bullet points' },
  { label: 'Step-by-step',  value: 'numbered step-by-step' },
  { label: 'Paragraphs',    value: 'short paragraphs' },
  { label: 'Table',         value: 'a table' },
  { label: 'Markdown',      value: 'markdown' },
  { label: 'JSON',          value: 'JSON' },
  { label: 'Summary',       value: 'a single concise paragraph' },
]

const TONES = [
  { label: 'Tone (any)', value: '' },
  { label: 'Professional',  value: 'professional and polished' },
  { label: 'Friendly',      value: 'friendly and conversational' },
  { label: 'Authoritative', value: 'authoritative and confident' },
  { label: 'Empathetic',    value: 'empathetic and warm' },
  { label: 'Direct',        value: 'concise and direct' },
  { label: 'Persuasive',    value: 'persuasive and compelling' },
  { label: 'Witty',         value: 'witty and engaging' },
  { label: 'Formal',        value: 'formal and academic' },
]

const AUDIENCES = [
  { label: 'Audience (any)',    value: '' },
  { label: 'General public',   value: 'general public' },
  { label: 'Business owners',  value: 'small business owners' },
  { label: 'Developers',       value: 'developers and engineers' },
  { label: 'Students',         value: 'students and learners' },
  { label: 'Executives',       value: 'executives and decision makers' },
  { label: 'Non-technical',    value: 'non-technical users' },
  { label: 'Freelancers',      value: 'freelancers and solopreneurs' },
  { label: 'Creators',         value: 'content creators' },
]

const LEARNING_STYLES = [
  { label: 'Visual',      value: 'visual (diagrams, mind maps, charts)' },
  { label: 'Reading',     value: 'reading and structured note-taking' },
  { label: 'Practice',    value: 'hands-on practice problems and coding' },
  { label: 'Flashcards',  value: 'spaced repetition and flashcards' },
  { label: 'Mixed',       value: 'mixed (theory + practice equally)' },
]

export default function Home() {
  const [goal, setGoal]         = useState('')
  const [roleCustom, setRoleCustom] = useState('')
  const [activeRole, setActiveRole] = useState('')
  const [activeFormats, setActiveFormats] = useState([])
  const [tone, setTone]         = useState('')
  const [audience, setAudience] = useState('')
  const [extra, setExtra]       = useState('')
  const [provider, setProvider] = useState('groq')
  const [context, setContext]           = useState('')
  const [hoursAvail, setHoursAvail]     = useState('')
  const [learningStyle, setLearningStyle] = useState('')

  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)  // { prompt, model, provider }
  const [error, setError]       = useState('')
  const [copied, setCopied]     = useState(false)
  const [goalError, setGoalError] = useState(false)

  function toggleFormat(val) {
    setActiveFormats(prev =>
      prev.includes(val) ? prev.filter(f => f !== val) : [...prev, val]
    )
  }

  async function generate() {
    if (!goal.trim()) { setGoalError(true); return }
    setGoalError(false)
    setLoading(true)
    setResult(null)
    setError('')

    const role = roleCustom.trim() || activeRole
    const format = activeFormats.join(', ')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, role, format, tone, audience, extra, provider, context, hoursAvail, learningStyle }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function copy() {
    if (!result?.prompt) return
    navigator.clipboard.writeText(result.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function wordCount(str) { return str.trim().split(/\s+/).filter(Boolean).length }

  return (
    <>
      {/* NAV */}
      <nav style={nav}>
        <div style={logo}>Prompt<span style={{ color: '#6B7C35' }}>Craft</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Provider toggle */}
          <div style={providerToggle}>
            {['groq', 'gemini'].map(p => (
              <button key={p} onClick={() => setProvider(p)}
                style={{ ...providerBtn, ...(provider === p ? providerActive : {}) }}>
                {p === 'groq' ? '⚡ Groq' : '✦ Gemini'}
              </button>
            ))}
          </div>
          <div style={badge}>AI Powered</div>
        </div>
      </nav>

      {/* APP */}
      <div style={appLayout}>

        {/* LEFT */}
        <div style={paneLeft}>
          <div style={paneTitle}>Build your prompt</div>
          <div style={paneSub}>Describe what you need — we'll craft the perfect AI prompt.</div>

          {/* Goal */}
          <Field label="What do you want the AI to help with?">
            <textarea rows={4} value={goal} onChange={e => { setGoal(e.target.value); setGoalError(false) }}
              placeholder="e.g. Write a cold email for my freelance automation business targeting Indian SMBs..."
              style={{ ...input, borderColor: goalError ? '#E2A87A' : undefined }} />
            {goalError && <div style={errMsg}>Please describe your goal first.</div>}
          </Field>

          <hr style={divider} />

          {/* Role */}
          <Field label="Role">
            <ChipGroup chips={ROLES} active={activeRole} onToggle={v => setActiveRole(prev => prev === v ? '' : v)} />
            <input type="text" value={roleCustom} onChange={e => setRoleCustom(e.target.value)}
              placeholder="Or type a custom role..."
              style={{ ...input, marginTop: '10px' }} />
          </Field>

          {/* Format */}
          <Field label="Output format">
            <ChipGroup chips={FORMATS} active={activeFormats} multi onToggle={toggleFormat} />
          </Field>

          {/* Advanced toggle */}
          <button onClick={() => setShowAdvanced(p => !p)} style={advancedToggle}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              style={{ transform: showAdvanced ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              <path d="M4 2l4 4-4 4" stroke="#A09C97" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {showAdvanced ? 'Hide advanced fields' : 'Advanced fields'}
            <span style={advancedHint}>context · time · learning style</span>
          </button>

          {showAdvanced && (
            <div style={advancedPanel}>
              <Field label="Context / Language / Tool" optional>
                <input type="text" value={context} onChange={e => setContext(e.target.value)}
                  placeholder="e.g. Java, Python, React, SQL, Excel..."
                  style={input} />
                <div style={fieldHint}>Anchors the prompt to a specific language or tool. "Java OOP" ≠ "Python OOP".</div>
              </Field>

              <Field label="Time available" optional>
                <input type="text" value={hoursAvail} onChange={e => setHoursAvail(e.target.value)}
                  placeholder="e.g. 4 hours/day, 2 days total, 30 minutes..."
                  style={input} />
                <div style={fieldHint}>Exact time constraints produce concrete plans instead of vague schedules.</div>
              </Field>

              <Field label="Learning style" optional>
                <ChipGroup chips={LEARNING_STYLES} active={learningStyle} onToggle={v => setLearningStyle(prev => prev === v ? '' : v)} />
                <div style={fieldHint}>Shapes how the AI structures and presents information.</div>
              </Field>
            </div>
          )}

          {/* Tone + Audience */}
          <Field label="Tone & audience">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Select options={TONES} value={tone} onChange={setTone} />
              <Select options={AUDIENCES} value={audience} onChange={setAudience} />
            </div>
          </Field>

          {/* Extra */}
          <Field label="Extra constraints" optional>
            <textarea rows={2} value={extra} onChange={e => setExtra(e.target.value)}
              placeholder="e.g. Keep under 150 words. Use Indian English. Focus on ROI..."
              style={input} />
          </Field>

          {/* Generate */}
          <button onClick={generate} disabled={loading} style={{ ...btnGenerate, opacity: loading ? 0.5 : 1 }}>
            {loading
              ? <><Spinner /> Generating...</>
              : <><PlusIcon /> Generate Prompt</>}
          </button>

          {/* Tips */}
          <div style={tipsBox}>
            <div style={tipsTitle}>Tips for best results</div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[
                'Add Context to anchor technical prompts (e.g. "Java" vs "Python")',
                'Set Time available for concrete plans instead of vague schedules',
                'Pick a Learning style to shape how info is presented',
                'Use Hard constraints to control length, language, and scope',
              ].map((t, i) => (
                <li key={i} style={tipItem}><span style={{ color: '#6B7C35' }}>→</span> {t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* RIGHT */}
        <div style={paneRight}>
          {!loading && !result && !error && (
            <div style={emptyState}>
              <div style={emptyIcon}>
                <DocIcon />
              </div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: '#6B6760', marginBottom: '4px' }}>Your prompt will appear here</div>
              <div style={{ fontSize: '13px', color: '#A09C97', fontWeight: 300, maxWidth: '220px', textAlign: 'center' }}>
                Fill in the fields on the left and click Generate Prompt
              </div>
            </div>
          )}

          {loading && (
            <div style={outputCard}>
              <div style={cardHead}>
                <div style={cardLabel}><div style={{ ...dot, background: '#D4A574', animation: 'pulse 1s infinite' }} /> Generating</div>
              </div>
              <div style={{ padding: '20px 18px' }}>
                {[90, 75, 85, 60, 80, 45].map((w, i) => (
                  <div key={i} style={{ ...skeleton, width: `${w}%`, marginBottom: i < 5 ? '10px' : 0 }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={outputCard}>
              <div style={{ padding: '20px 18px', fontSize: '14px', color: '#A09C97' }}>
                ⚠ {error}
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              <div style={paneTitle}>Your prompt</div>
              <div style={{ ...paneSub, marginBottom: '1rem' }}>Ready to copy and use anywhere.</div>

              <div style={{ ...outputCard, animation: 'slideUp 0.3s ease' }}>
                <div style={cardHead}>
                  <div style={cardLabel}><div style={dot} /> Prompt ready</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={modelBadge}>{result.model}</span>
                    <button onClick={copy} style={{ ...btnSm, ...(copied ? btnCopied : {}) }}>
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div style={outputBody}>{result.prompt}</div>
                <div style={statsRow}>
                  <span style={stat}><strong>{wordCount(result.prompt)}</strong> words</span>
                  <span style={stat}><strong>{result.prompt.length}</strong> characters</span>
                </div>
              </div>

              <button onClick={generate} style={btnRegen}>↺ Regenerate</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

function Field({ label, optional, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={fieldLabel}>
        {label}
        {optional && <span style={optTag}>optional</span>}
      </div>
      {children}
    </div>
  )
}

function ChipGroup({ chips, active, multi, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
      {chips.map(c => {
        const isActive = multi ? active.includes(c.value) : active === c.value
        return (
          <button key={c.value} onClick={() => onToggle(c.value)}
            style={{ ...chip, ...(isActive ? chipActive : {}) }}>
            {c.label}
          </button>
        )
      })}
    </div>
  )
}

function Select({ options, value, onChange }) {
  return (
    <div style={{ position: 'relative' }}>
      <select value={value} onChange={e => onChange(e.target.value)} style={select}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div style={selectArrow}>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#A09C97" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
      <path d="M12 3a9 9 0 0 1 9 9" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <path d="M7.5 1.5v12M1.5 7.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function DocIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="#6B6760" strokeWidth="1.3"/>
      <path d="M7 9h10M7 12h7M7 15h5" stroke="#6B6760" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────

const nav = {
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
  background: 'rgba(247,245,240,0.9)', backdropFilter: 'blur(12px)',
  borderBottom: '1px solid #E4E0D9',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 2rem', height: '56px',
}

const logo = {
  fontFamily: "'DM Serif Display', serif",
  fontSize: '18px', color: '#1A1714', letterSpacing: '-0.3px',
}

const badge = {
  fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px',
  color: '#6B7C35', background: '#EFF2E6',
  border: '1px solid #D4DB9F', borderRadius: '20px',
  padding: '3px 10px', textTransform: 'uppercase',
}

const providerToggle = {
  display: 'flex', background: '#F0EDE8', borderRadius: '8px',
  padding: '3px', border: '1px solid #E4E0D9',
}

const providerBtn = {
  fontSize: '12px', padding: '4px 12px', border: 'none',
  borderRadius: '6px', background: 'transparent', color: '#6B6760',
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
  transition: 'all 0.14s',
}

const providerActive = {
  background: '#FFF', color: '#1A1714', fontWeight: 500,
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}

const appLayout = {
  minHeight: '100vh', paddingTop: '56px',
  display: 'grid', gridTemplateColumns: '1fr 1fr',
}

const paneBase = {
  padding: '2.5rem 2rem', overflowY: 'auto', height: 'calc(100vh - 56px)',
}

const paneLeft  = { ...paneBase, borderRight: '1px solid #E4E0D9' }
const paneRight = { ...paneBase }

const paneTitle = {
  fontFamily: "'DM Serif Display', serif",
  fontSize: '22px', color: '#1A1714', letterSpacing: '-0.4px', marginBottom: '4px',
}

const paneSub = {
  fontSize: '13px', color: '#A09C97', fontWeight: 300, marginBottom: '2rem',
}

const fieldLabel = {
  fontSize: '11px', fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.7px', color: '#6B6760',
  marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px',
}

const optTag = {
  fontSize: '10px', fontWeight: 400, color: '#A09C97',
  background: '#F0EDE8', borderRadius: '4px',
  padding: '1px 6px', letterSpacing: 0, textTransform: 'none',
}

const input = {
  width: '100%', border: '1px solid #E4E0D9', borderRadius: '10px',
  padding: '12px 14px', fontSize: '14px',
  fontFamily: "'DM Sans', sans-serif", fontWeight: 300,
  background: '#FFF', color: '#1A1714', resize: 'none', outline: 'none', lineHeight: 1.6,
}

const chip = {
  fontSize: '13px', padding: '6px 14px', borderRadius: '30px',
  border: '1px solid #E4E0D9', background: '#FFF', color: '#6B6760',
  cursor: 'pointer', transition: 'all 0.14s', userSelect: 'none', lineHeight: 1,
  fontFamily: "'DM Sans', sans-serif",
}

const chipActive = {
  background: '#1A1714', color: '#FFF', borderColor: '#1A1714',
}

const select = {
  width: '100%', border: '1px solid #E4E0D9', borderRadius: '10px',
  padding: '10px 36px 10px 14px', fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif", fontWeight: 400,
  background: '#FFF', color: '#1A1714', outline: 'none', cursor: 'pointer',
  appearance: 'none',
}

const selectArrow = {
  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
  pointerEvents: 'none',
}

const divider = { border: 'none', borderTop: '1px solid #E4E0D9', margin: '1.75rem 0' }

const btnGenerate = {
  width: '100%', padding: '13px',
  background: '#1A1714', color: '#FFF',
  border: 'none', borderRadius: '10px',
  fontSize: '14px', fontWeight: 500,
  fontFamily: "'DM Sans', sans-serif",
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
}

const tipsBox = {
  marginTop: '1.5rem', border: '1px solid #E4E0D9',
  borderRadius: '10px', background: '#F0EDE8', padding: '16px 18px',
}

const tipsTitle = {
  fontSize: '11px', fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.7px', color: '#A09C97', marginBottom: '10px',
}

const tipItem = {
  fontSize: '13px', color: '#6B6760', fontWeight: 300,
  display: 'flex', gap: '8px', alignItems: 'flex-start',
}

const emptyState = {
  height: '100%', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center',
  opacity: 0, animation: 'fadeIn 0.6s 0.3s forwards',
}

const emptyIcon = {
  width: '56px', height: '56px', borderRadius: '14px',
  background: '#F0EDE8', border: '1px solid #E4E0D9',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  marginBottom: '1rem',
}

const outputCard = {
  background: '#FFF', border: '1px solid #E4E0D9',
  borderRadius: '16px', overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(26,23,20,0.06)',
}

const cardHead = {
  padding: '14px 18px', borderBottom: '1px solid #E4E0D9',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
}

const cardLabel = {
  fontSize: '11px', fontWeight: 500, textTransform: 'uppercase',
  letterSpacing: '0.7px', color: '#A09C97',
  display: 'flex', alignItems: 'center', gap: '7px',
}

const dot = { width: '6px', height: '6px', borderRadius: '50%', background: '#6B7C35' }

const modelBadge = {
  fontSize: '11px', color: '#6B7C35', background: '#EFF2E6',
  border: '1px solid #D4DB9F', borderRadius: '4px', padding: '2px 7px',
  fontWeight: 400,
}

const btnSm = {
  fontSize: '12px', padding: '5px 12px',
  border: '1px solid #E4E0D9', borderRadius: '6px',
  background: '#FFF', color: '#6B6760', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif",
}

const btnCopied = { background: '#EFF2E6', color: '#6B7C35', borderColor: '#D4DB9F' }

const outputBody = {
  padding: '20px 18px', fontSize: '14px', fontWeight: 300,
  lineHeight: 1.75, color: '#1A1714', whiteSpace: 'pre-wrap', minHeight: '160px',
}

const statsRow = {
  display: 'flex', gap: '12px', padding: '12px 18px',
  borderTop: '1px solid #E4E0D9', background: '#F7F5F0',
}

const stat = { fontSize: '12px', color: '#A09C97' }

const skeleton = {
  background: 'linear-gradient(90deg, #F0EDE8 25%, #EDE9E2 50%, #F0EDE8 75%)',
  backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite',
  borderRadius: '4px', height: '14px',
}

const errMsg = { fontSize: '12px', color: '#E2A87A', marginTop: '6px' }

const fieldHint = {
  fontSize: '11px', color: '#A09C97', marginTop: '6px', fontWeight: 300, lineHeight: 1.5,
}

const btnRegen = {
  width: '100%', marginTop: '12px', padding: '11px',
  background: 'transparent', color: '#6B6760',
  border: '1px solid #E4E0D9', borderRadius: '10px',
  fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
  cursor: 'pointer',
}

const advancedToggle = {
  display: 'flex', alignItems: 'center', gap: '7px',
  fontSize: '12px', color: '#A09C97', background: 'none',
  border: 'none', padding: '0', cursor: 'pointer',
  fontFamily: "'DM Sans', sans-serif", marginBottom: '1.5rem',
}

const advancedHint = {
  fontSize: '11px', color: '#C5C0B8', fontWeight: 300,
}

const advancedPanel = {
  background: '#F7F5F0', border: '1px solid #E4E0D9',
  borderRadius: '12px', padding: '18px 16px',
  marginBottom: '1.5rem',
}
