import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Users, Calendar, Trophy } from 'lucide-react'

const STATS = [
  { icon: Users, value: '500+', label: 'Active Members' },
  { icon: Calendar, value: '52+', label: 'Weekly Runs' },
  { icon: MapPin, value: '7+', label: 'Years Running' },
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
    desc: 'Tirupur Runners Marathon — one of Tamil Nadu's most celebrated running events.',
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
      <section className="relative bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-32">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-sm mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Tirupur, Tamil Nadu 🏃
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-6xl leading-tight mb-6">
              Run Together.<br />
              <span className="text-brand-200">Grow Together.</span>
            </h1>
            <p className="text-lg text-brand-100 mb-8 leading-relaxed">
              Join Tirupur's most vibrant running club. From your first 5K to your marathon PR —
              we run every stride as a community.
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
          <p className="text-brand-100 mb-8">Annual membership at just ₹500. Join 500+ runners today.</p>
          <Link to="/register" className="btn-primary bg-white text-brand-700 hover:bg-brand-50 py-3.5 px-10 text-base">
            Register Now <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  )
}
