import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 mt-24">
      <div className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">TR</span>
            </div>
            <span className="text-white font-display font-bold">Tirupur Runners</span>
          </div>
          <p className="text-sm leading-relaxed">
            Building a stronger running community in Tirupur, Tamil Nadu since 2018.
          </p>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            {[
              ['/', 'Home'],
              ['/about', 'About Us'],
              ['/events', 'Events'],
              ['/members/register', 'Join the Club'],
              ['/contact', 'Contact'],
            ].map(([to, label]) => (
              <li key={to}>
                <Link to={to} className="hover:text-white transition-colors">{label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-white font-semibold mb-3 text-sm">Newsletter</h4>
          <p className="text-sm mb-3">Stay updated with runs, events, and training tips.</p>
          {/* Placeholder — backend extensible */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
            <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-1">Email integration coming soon.</p>
        </div>
      </div>

      <div className="border-t border-gray-800 px-4 py-4">
        <p className="text-center text-xs text-gray-600">
          © {new Date().getFullYear()} Tirupur Runners Club. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
