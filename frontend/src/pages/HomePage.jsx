import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Users, Calendar, Trophy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

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
    desc: 'Toplight Tirupur Runners Marathon — next edition coming soon. Watch this space.',
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
  const { settings, user } = useAuthStore()
  const showJoin = !user && settings?.show_join_club !== 'false'

  return (
    <div className="pt-16">
      {/* Hero — gradient background + poster image side by side */}
      <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-10 md:gap-16">
          {/* Left: text */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-1.5 rounded-full text-sm mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Next Marathon: Coming Soon · Tirupur, TN 🏃
            </div>
            <h1 className="font-display font-extrabold text-4xl md:text-5xl leading-tight mb-5">
              Lace Up.<br />
              <span className="text-brand-200">Show Up.</span><br />
              Run Together.
            </h1>
            <p className="text-brand-100 text-base md:text-lg mb-8 leading-relaxed">
              Join Tirupur's most vibrant running club — established 2013. From your first 5K
              to your marathon PR, we run every stride as a community.
            </p>
            <div className="flex flex-wrap gap-3">
              {showJoin && (
                <Link to="/members/register" className="btn-primary bg-white text-brand-700 hover:bg-brand-50 py-3.5 px-8 text-base">
                  Join the Club <ArrowRight size={18} />
                </Link>
              )}
              <Link to="/events" className="btn-outline border-white text-white hover:bg-white/10 py-3.5 px-8 text-base">
                View Events
              </Link>
            </div>
          </div>

          {/* Right: marathon poster — natural portrait display */}
          <div className="flex-shrink-0 w-full md:w-72 lg:w-80">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/20">
              <img
                src="https://racemart.in/storage/poster/poster-1748432314814.png"
                alt="Toplight Tirupur Runners Marathon — Coming Soon"
                className="w-full h-auto block"
                onError={(e) => {
                  e.target.parentElement.innerHTML = `
                    <div class="bg-brand-700 rounded-2xl p-8 text-center text-white">
                      <div class="text-5xl mb-3">🏅</div>
                      <p class="font-bold text-lg">Toplight Tirupur Runners Marathon</p>
                      <p class="text-brand-200 text-sm mt-1">Coming Soon</p>
                    </div>`
                }}
              />
              {/* Date badge */}
              <div className="absolute bottom-3 left-3 right-3 bg-brand-900/80 backdrop-blur rounded-xl px-4 py-2.5 text-center">
                <p className="text-white font-bold text-sm">Coming Soon</p>
                <p className="text-brand-200 text-xs">5K · 10K · 21K</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-6xl mx-auto px-4 -mt-6 relative z-10">
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
          <p className="text-brand-100 mb-2">New membership — ₹2,000 &nbsp;·&nbsp; Renewal — ₹1,500</p>
          <p className="text-brand-200 text-sm mb-8">Join 250+ runners. Be part of Tirupur's running community.</p>
          {showJoin && (
            <Link to="/members/register" className="btn-primary bg-white text-brand-700 hover:bg-brand-50 py-3.5 px-10 text-base">
              Register Now <ArrowRight size={18} />
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}
