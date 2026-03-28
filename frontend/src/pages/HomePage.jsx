import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Users, Calendar, Trophy } from 'lucide-react'

const STATS = [
  { icon: Users, value: '250+', label: 'Active Members' },
  { icon: Calendar, value: '52+', label: 'Weekly Runs' },
  { icon: MapPin, value: '12+', label: 'Years Running' },
  { icon: Trophy, value: '3500+', label: 'Marathon Finishers' },
]

const FEATURES = [
  {
    title: 'Weekly Group Runs',
    desc: 'Join our 5am runs every Sunday at VOC Park. Beginners to ultrarunners welcome.',
    emoji: '🏃',
  },
  {
    title: 'Annual Marathon',
    desc: 'Toplight Tirupur Runners Marathon — next edition on August 2, 2026.',
    emoji: '🏅',
  },
  {
    title: 'Training Support',
    desc: 'Structured training plans, experienced pacers, and a community that pushes you.',
    emoji: '📈',
  },
  {
    title: 'Runner Safety',
    desc: 'Emergency contacts, first aid coverage, and a buddy system on all long runs.',
    emoji: '🛡️',
  },
]

export default function HomePage() {
  return (
    <div className="pt-16">
      {/* Hero */}
      <section className="relative text-white overflow-hidden" style={{ minHeight: '560px' }}>
        {/* Background image from marathon event poster */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("https://racemart.in/storage/poster/poster-1748432314814.png")`,
          }}
        />
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-800/80 to-brand-600/70" />

        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-sm mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Next Marathon: August 2, 2026 · Tirupur, Tamil Nadu 🏃
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl leading-tight mb-6">
              Lace Up.<br />
              <span className="text-brand-200">Show Up. Run Together.</span>
            </h1>
            <p className="text-lg text-brand-100 mb-8 leading-relaxed">
              Join Tirupur's most vibrant running club — established 2013. From your first 5K to your
              marathon PR, we run every stride as a community.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary bg-white text-brand-700 hover:bg-brand-50 py-3.5 px-8 text-base">
                Join the Club <ArrowRight size={18} />
              </Link>
              <Link to="/events" className="btn-outline border-white text-white hover:bg-white/10 py-3.5 px-8 text-base">
                View Events
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="card text-center">
              <Icon size={22} className="text-brand-600 mx-auto mb-2" />
              <p className="font-display font-bold text-2xl text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Marathon Highlight Banner */}
      <section className="max-w-6xl mx-auto px-4 pt-12">
        <div className="relative rounded-2xl overflow-hidden">
          <img
            src="https://racemart.in/storage/poster/poster-1748432314814.png"
            alt="Toplight Tirupur Runners Marathon 2026"
            className="w-full object-cover max-h-72 rounded-2xl"
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900/80 to-transparent rounded-2xl flex items-center px-8">
            <div className="text-white max-w-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-200 mb-1">Mark Your Calendar</p>
              <h2 className="font-display font-bold text-2xl md:text-3xl mb-2">
                Toplight Tirupur Runners Marathon
              </h2>
              <p className="text-sm text-brand-100 mb-4">August 2, 2026 · 5K · 10K · 21K</p>
              <Link to="/events" className="inline-flex items-center gap-2 bg-white text-brand-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-brand-50 transition-colors">
                Event Details <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="font-display font-bold text-3xl md:text-4xl text-gray-900 mb-3">
            Why Join Tirupur Runners?
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            More than a running club — a community that keeps you moving, motivated, and healthy.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="card hover:shadow-md transition-shadow flex gap-4">
              <span className="text-3xl">{f.emoji}</span>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 text-white py-16">
        <div className="max-w-2xl mx-auto text-center px-4">
          <h2 className="font-display font-bold text-3xl mb-4">Ready to start running?</h2>
          <p className="text-brand-100 mb-2">New membership — ₹2,000 &nbsp;·&nbsp; Renewal — ₹1,500</p>
          <p className="text-brand-200 text-sm mb-8">Join 250+ runners. Be part of Tirupur's running community.</p>
          <Link to="/register" className="btn-primary bg-white text-brand-700 hover:bg-brand-50 py-3.5 px-10 text-base">
            Register Now <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  )
}
