import React, { useState, useEffect } from 'react'

const CONSENT_KEY = 'psiquant_analytics_consent'

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(CONSENT_KEY)
    if (consent === null) {
      // No choice made yet, show banner after 1 second
      setTimeout(() => setShowBanner(true), 1000)
    } else if (consent === 'accepted') {
      // User accepted, initialize GA4
      initializeGA4()
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted')
    setShowBanner(false)
    initializeGA4()
  }

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, 'rejected')
    setShowBanner(false)
  }

  const initializeGA4 = () => {
    // This will be called by the script in index.html
    if (window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted'
      })
    }
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-50 animate-slide-up sm:max-w-sm">
      {/* Toast Container */}
      <div className="bg-void-900/95 backdrop-blur-md border border-neon-cyan/30 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4">

        {/* Message */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-2xl flex-shrink-0">🍪</span>
          <p className="text-sm text-gray-300 leading-relaxed">
            We use cookies for analytics to improve this tool. <span className="text-neon-cyan font-medium">Help us out?</span>
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleReject}
            className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-5 py-2 text-xs font-medium bg-neon-cyan/10 hover:bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 rounded-md transition-all duration-200 hover:shadow-[0_0_12px_rgba(14,165,233,0.3)]"
          >
            Accept
          </button>
        </div>

      </div>
    </div>
  )
}
