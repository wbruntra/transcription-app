import React from 'react'

/**
 * Provider selection component with radio buttons
 * @param {Object} props
 * @param {string} props.provider - Current provider ('openai' or 'xai')
 * @param {(provider: string) => void} props.onProviderChange - Provider change handler
 */
export function ProviderSelector({ provider, onProviderChange }) {
  return (
    <div className="d-flex align-items-center gap-3 mt-3">
      <span className="fw-semibold">Provider:</span>
      <div className="btn-group btn-group-sm" role="group">
        <input
          type="radio"
          className="btn-check"
          name="provider"
          id="provider-openai"
          value="openai"
          checked={provider === 'openai'}
          onChange={() => onProviderChange('openai')}
        />
        <label className="btn btn-outline-secondary" htmlFor="provider-openai">
          OpenAI
        </label>
        <input
          type="radio"
          className="btn-check"
          name="provider"
          id="provider-xai"
          value="xai"
          checked={provider === 'xai'}
          onChange={() => onProviderChange('xai')}
        />
        <label className="btn btn-outline-secondary" htmlFor="provider-xai">
          xAI
        </label>
        <input
          type="radio"
          className="btn-check"
          name="provider"
          id="provider-danarch"
          value="danarch"
          checked={provider === 'danarch'}
          onChange={() => onProviderChange('danarch')}
        />
        <label className="btn btn-outline-secondary" htmlFor="provider-danarch">
          Danarch
        </label>
        <input
          type="radio"
          className="btn-check"
          name="provider"
          id="provider-openrouter"
          value="openrouter"
          checked={provider === 'openrouter'}
          onChange={() => onProviderChange('openrouter')}
        />
        <label className="btn btn-outline-secondary" htmlFor="provider-openrouter">
          Qwen
        </label>
      </div>
    </div>
  )
}
