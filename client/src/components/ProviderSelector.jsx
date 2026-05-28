import React from 'react'

export function ProviderSelector({ providers, provider, onProviderChange }) {
  return (
    <div className="d-flex align-items-center gap-3 mt-3">
      <span className="fw-semibold">Provider:</span>
      <div className="btn-group btn-group-sm" role="group">
        {providers.map((p) => (
          <React.Fragment key={p.id}>
            <input
              type="radio"
              className="btn-check"
              name="provider"
              id={`provider-${p.id}`}
              value={p.id}
              checked={provider === p.id}
              onChange={() => onProviderChange(p.id)}
            />
            <label className="btn btn-outline-secondary" htmlFor={`provider-${p.id}`}>
              {p.label}
            </label>
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
