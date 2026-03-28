import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/events', label: 'Events' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { user, logout, settings } = useAuthStore()
  const location = useLocation()
  const navigate = useNavigate()

  const onMembersPath = location.pathname.startsWith('/members')

  const showLogin    = onMembersPath && settings?.show_login    !== 'false'
  const showRegister = onMembersPath && settings?.show_register !== 'false'

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="https://racemart.in/storage/partners/partner-1748525507271.jpg"
            alt="Tirupur Runners"
            className="h-9 w-9 object-contain rounded-xl"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
          <div className="w-9 h-9 bg-brand-600 rounded-xl items-center justify-center hidden">
            <span className="text-white font-display font-bold text-sm">TR</span>
          </div>
          <span className="font-display font-bold text-gray-900 text-lg leading-tight">
            Tirupur <span className="text-brand-600">Runners</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === link.to
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth actions */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {user.is_admin && (
                <Link to="/admin" className="text-xs font-semibold text-brand-600 hover:underline px-2">
                  Admin
                </Link>
              )}
              <Link
                to="/members/dashboard"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-sm font-medium transition-colors"
              >
                <User size={14} /> {user.full_name.split(' ')[0]}
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-500 hover:text-red-500 hover:bg-red-50 text-sm transition-colors"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              {showLogin    && <Link to="/members/login"    className="btn-outline py-2 text-sm">Login</Link>}
              {showRegister && <Link to="/members/register" className="btn-primary py-2 text-sm">Register</Link>}
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className="px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {link.label}
            </Link>
          ))}
          {!user && (showLogin || showRegister) && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
              {showLogin    && <Link to="/members/login"    onClick={() => setOpen(false)} className="btn-outline flex-1 py-2 text-sm">Login</Link>}
              {showRegister && <Link to="/members/register" onClick={() => setOpen(false)} className="btn-primary flex-1 py-2 text-sm">Register</Link>}
            </div>
          )}
          {user && (
            <button onClick={handleLogout} className="text-left px-3 py-2.5 text-sm text-red-500 font-medium">
              Logout
            </button>
          )}
        </div>
      )}
    </nav>
  )
}
