'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Compass, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  X, 
  Play, 
  Layers, 
  Clock, 
  Calendar, 
  Users, 
  User, 
  Zap,
  Sliders,
  ShieldCheck,
  FileCheck,
  Edit3
} from 'lucide-react';

export interface TourStep {
  targetId: string;
  tag: string;
  title: string;
  content: string;
  icon: any;
  preferredPosition?: 'top' | 'bottom' | 'left' | 'right';
  category?: string;
  subTab?: string;
  openProfileModal?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  // 1. OVERVIEW: Main Navigation Sidebar
  {
    targetId: 'tour-sidebar',
    tag: 'MODULE 1 OF 3: OVERVIEW',
    title: 'Main Navigation Sidebar',
    content: 'The application is organized into dedicated modules accessible via this left sidebar. Icons are available for Timesheet, Audit Log, and role-based administration tools. Hover over any icon to preview its category title.',
    icon: Compass,
    preferredPosition: 'right',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 2. TIMESHEET MENU: Sub-Tabs Header
  {
    targetId: 'tour-subtabs',
    tag: 'TIMESHEET MODULE: SUB-MENUS',
    title: 'Timesheet Module & Sub-Tabs',
    content: 'The Timesheet module is divided into 3 dedicated sub-menus: "Timesheet Entry" (for daily logging), "Activity Log" (for submission history), and "User Settings" (for default preferences). Let us explore each one in order!',
    icon: Layers,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 3. TIMESHEET SUB-MENU 1: Timesheet Entry
  {
    targetId: 'tour-subtab-timesheet',
    tag: 'SUB-MENU 1: TIMESHEET ENTRY',
    title: 'Daily Timesheet Entry Form',
    content: 'This is your primary workplace for entering and managing daily working hours. Let us look at the key features and tools available inside this form.',
    icon: Clock,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 4. TIMESHEET FEATURE: Date Range Picker
  {
    targetId: 'tour-date-range',
    tag: 'TIMESHEET FEATURE: PERIOD',
    title: '1. Date Range & Work Period',
    content: 'Select the Start Date and End Date for your weekly reporting cycle. The daily timesheet table below dynamically generates the corresponding calendar dates and day names for your selected range.',
    icon: Calendar,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 5. TIMESHEET FEATURE: Quick Fill & Shift Presets
  {
    targetId: 'tour-quick-actions',
    tag: 'TIMESHEET FEATURE: SHORTCUTS',
    title: '2. Quick Fill 10h & Shift Presets',
    content: 'Save repetitive typing! Click "Fill 10h Mon-Sat" to automatically assign 10 standard work hours (Monday to Saturday, with Sunday off/0h), or use "All Day Shift" and "All Night Shift" to batch-assign shift types across all rows.',
    icon: Zap,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 6. TIMESHEET FEATURE: Daily Timesheet Table
  {
    targetId: 'tour-timesheet-table',
    tag: 'TIMESHEET FEATURE: GRID',
    title: '3. Daily Work Hours & Area Grid',
    content: 'Enter your regular working hours, overtime hours, commissioning tags (Area 1 & Area 2), shift types, and activity remarks for each working day. Summary totals calculate in realtime at the bottom footer.',
    icon: Clock,
    preferredPosition: 'top',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 7. TIMESHEET FEATURE: Submit & Save
  {
    targetId: 'tour-submit-timesheet',
    tag: 'TIMESHEET FEATURE: SUBMISSION',
    title: '4. Submit & Save Timesheet',
    content: 'Once your daily rows and total hours are verified, click "Submit Timesheet" to securely record and submit your entire timesheet to the database server.',
    icon: Check,
    preferredPosition: 'top',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 8. TIMESHEET FEATURE: Editing Already Submitted Timesheets
  {
    targetId: 'tour-timesheet-table',
    tag: 'TIMESHEET FEATURE: REVISION',
    title: '5. Editing Already Submitted Timesheets',
    content: 'Need to revise hours, shifts, areas, or remarks for a timesheet that was already submitted? Simply re-select the Start Date & End Date of that week in the Date Range picker. Your saved records will automatically load into the grid. Edit the entries directly in the table, then click "Submit Timesheet" again to save your updates to the server!',
    icon: Edit3,
    preferredPosition: 'top',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 9. TIMESHEET SUB-MENU 2: Activity Log
  {
    targetId: 'tour-subtab-activity',
    tag: 'SUB-MENU 2: ACTIVITY LOG',
    title: 'Activity Log & Past Submissions',
    content: 'This sub-menu displays your complete submission history. You can inspect previous timesheet submissions, date ranges, total logged hours, timestamps, and review verification statuses.',
    icon: FileCheck,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'activity_log'
  },

  // 10. TIMESHEET SUB-MENU 3: User Settings
  {
    targetId: 'tour-subtab-settings',
    tag: 'SUB-MENU 3: USER SETTINGS',
    title: 'User Settings & Default Preferences',
    content: 'Customize your work preferences here! Set your default primary Area 1, secondary Area 2, and preferred Shift (Day/Night). New timesheets will automatically pre-populate with these defaults.',
    icon: Sliders,
    preferredPosition: 'bottom',
    category: 'timesheet',
    subTab: 'user_settings'
  },

  // 11. AUDIT LOG MENU: Personal & System Audit Trail
  {
    targetId: 'tour-sidebar-audit',
    tag: 'MODULE 2 OF 3: AUDIT LOG',
    title: 'Audit Log & Security History',
    content: 'The Audit Log module tracks activity and security records. Regular users can review their own personal logs (login timestamps, submissions, profile updates), while Admins have full access to system-wide audit records.',
    icon: ShieldCheck,
    preferredPosition: 'right',
    category: 'audit_log',
    subTab: 'audit_log'
  },

  // 12. LIVE COLLABORATION: Realtime Team & Chat
  {
    targetId: 'tour-online-presence',
    tag: 'MODULE 3 OF 3: COLLABORATION',
    title: 'Online Team Presence & Realtime Chat',
    content: 'Check which team members are currently online on the right sidebar. Click on any colleague or use the floating chat widget at the bottom right to message teammates and share project documents in realtime!',
    icon: Users,
    preferredPosition: 'left',
    category: 'timesheet',
    subTab: 'timesheet_entry'
  },

  // 13. USER ACCOUNT: Profile Settings & AI Face ID
  {
    targetId: 'tour-profile-modal-content',
    tag: 'ACCOUNT & SECURITY',
    title: 'User Profile Settings & AI Face ID',
    content: 'Here you can upload your profile photo, customize your display info, change your account password, and enroll your biometric AI Face ID for instant passwordless login.',
    icon: User,
    preferredPosition: 'right',
    category: 'timesheet',
    subTab: 'timesheet_entry',
    openProfileModal: true
  }
];

interface InteractiveAppTourProps {
  user: any;
  isOpenManual?: boolean;
  onCloseManual?: () => void;
  onNavigate?: (category: string, subTab: string) => void;
  onOpenProfileSettings?: () => void;
  onCloseProfileSettings?: () => void;
}

export default function InteractiveAppTour({
  user,
  isOpenManual = false,
  onCloseManual,
  onNavigate,
  onOpenProfileSettings,
  onCloseProfileSettings
}: InteractiveAppTourProps) {
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentStep = TOUR_STEPS[currentStepIndex];

  // 1. Check if user is first time login
  useEffect(() => {
    if (!user) return;
    try {
      const tourKey = `metso_tour_completed_${user.id}`;
      const hasCompletedTour = localStorage.getItem(tourKey);

      if (!hasCompletedTour && !isOpenManual) {
        // Offer tour modal with slight delay for smooth page entrance
        const timer = setTimeout(() => {
          setShowWelcomeModal(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    } catch (e) {}
  }, [user, isOpenManual]);

  // 2. Handle manual trigger from outside (e.g. Help / Tour button in Navbar or bottom left)
  useEffect(() => {
    if (isOpenManual) {
      setShowWelcomeModal(false);
      setCurrentStepIndex(0);
      setIsTourActive(true);
    }
  }, [isOpenManual]);

  // 3. Auto navigation to match active step
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    if (currentStep.category && currentStep.subTab && onNavigate) {
      onNavigate(currentStep.category, currentStep.subTab);
    }

    if (currentStep.openProfileModal && onOpenProfileSettings) {
      onOpenProfileSettings();
    } else if (onCloseProfileSettings) {
      onCloseProfileSettings();
    }
  }, [isTourActive, currentStepIndex, currentStep, onNavigate, onOpenProfileSettings, onCloseProfileSettings]);

  // 4. Highlight positioning & element tracking
  const updateTargetPosition = useCallback(() => {
    if (!isTourActive || !currentStep) return;

    // Check if target is inside modal when open
    let targetElId = currentStep.targetId;
    if (currentStep.openProfileModal) {
      const modalEl = document.getElementById('tour-profile-modal-content');
      if (modalEl) {
        const rect = modalEl.getBoundingClientRect();
        setTargetRect(rect);
        return;
      }
    }

    const el = document.getElementById(targetElId);
    if (el) {
      // Scroll element smoothly into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      // Fallback: target element not present on screen
      setTargetRect(null);
    }
  }, [isTourActive, currentStep]);

  useEffect(() => {
    if (!isTourActive) return;

    // Small delay to let tab navigation render
    const initialTimer = setTimeout(updateTargetPosition, 120);

    const handleResizeOrScroll = () => {
      updateTargetPosition();
    };

    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    const timeout = setTimeout(updateTargetPosition, 300);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(timeout);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isTourActive, currentStepIndex, updateTargetPosition]);

  // 5. Typewriter Effect Logic for Step Content
  useEffect(() => {
    if (!isTourActive || !currentStep) return;

    if (typingTimerRef.current) clearInterval(typingTimerRef.current);

    const textToType = currentStep.content;
    setDisplayedText('');
    setIsTyping(true);

    let charIdx = 0;
    typingTimerRef.current = setInterval(() => {
      if (charIdx < textToType.length) {
        setDisplayedText(textToType.slice(0, charIdx + 1));
        charIdx++;
      } else {
        setIsTyping(false);
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      }
    }, 18); // 18ms per character for smooth typewriter animation

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    };
  }, [isTourActive, currentStepIndex, currentStep]);

  const completeTypingInstantly = () => {
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    setDisplayedText(currentStep.content);
    setIsTyping(false);
  };

  const handleStartTour = () => {
    setShowWelcomeModal(false);
    setCurrentStepIndex(0);
    setIsTourActive(true);
  };

  const handleDismissWelcome = () => {
    setShowWelcomeModal(false);
    if (user?.id) {
      try {
        localStorage.setItem(`metso_tour_completed_${user.id}`, 'true');
      } catch (e) {}
    }
  };

  const handleNextStep = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleFinishTour();
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleFinishTour = () => {
    setIsTourActive(false);
    if (onNavigate) {
      onNavigate('timesheet', 'timesheet_entry');
    }
    if (onCloseProfileSettings) {
      onCloseProfileSettings();
    }
    if (user?.id) {
      try {
        localStorage.setItem(`metso_tour_completed_${user.id}`, 'true');
      } catch (e) {}
    }
    if (onCloseManual) onCloseManual();
  };

  // Helper to calculate callout box position relative to target
  const getCalloutStyle = () => {
    const padding = 16;
    const calloutWidth = 380;
    const estimatedCalloutHeight = 280;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    if (!targetRect) {
      // Centered fallback
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: `${Math.min(calloutWidth, windowWidth - 32)}px`,
        width: '100%'
      };
    }

    const spaceAbove = targetRect.top;
    const spaceBelow = windowHeight - targetRect.bottom;
    const spaceRight = windowWidth - targetRect.right;
    const spaceLeft = targetRect.left;

    let pos = currentStep.preferredPosition || 'bottom';

    // If preferred is top, check if space above is sufficient
    if (pos === 'top' && spaceAbove < estimatedCalloutHeight + padding) {
      if (spaceBelow >= estimatedCalloutHeight + padding) {
        pos = 'bottom';
      } else if (spaceRight >= calloutWidth + padding) {
        pos = 'right';
      } else if (spaceLeft >= calloutWidth + padding) {
        pos = 'left';
      } else {
        // Fallback for large elements (like profile modal)
        pos = spaceRight >= spaceLeft ? 'right' : 'left';
      }
    }

    // If preferred is bottom, check if space below is sufficient
    if (pos === 'bottom' && spaceBelow < estimatedCalloutHeight + padding) {
      if (spaceAbove >= estimatedCalloutHeight + padding) {
        pos = 'top';
      } else if (spaceRight >= calloutWidth + padding) {
        pos = 'right';
      } else if (spaceLeft >= calloutWidth + padding) {
        pos = 'left';
      } else {
        pos = spaceRight >= spaceLeft ? 'right' : 'left';
      }
    }

    // If preferred is right, check if space right is sufficient
    if (pos === 'right' && spaceRight < calloutWidth + padding) {
      if (spaceLeft >= calloutWidth + padding) {
        pos = 'left';
      } else if (spaceBelow >= estimatedCalloutHeight + padding) {
        pos = 'bottom';
      } else if (spaceAbove >= estimatedCalloutHeight + padding) {
        pos = 'top';
      }
    }

    // If preferred is left, check if space left is sufficient
    if (pos === 'left' && spaceLeft < calloutWidth + padding) {
      if (spaceRight >= calloutWidth + padding) {
        pos = 'right';
      } else if (spaceBelow >= estimatedCalloutHeight + padding) {
        pos = 'bottom';
      } else if (spaceAbove >= estimatedCalloutHeight + padding) {
        pos = 'top';
      }
    }

    let calculatedTop = 0;
    let calculatedLeft = 0;

    if (pos === 'right') {
      calculatedLeft = targetRect.right + padding;
      calculatedTop = targetRect.top + (targetRect.height / 2) - (estimatedCalloutHeight / 2);
    } else if (pos === 'left') {
      calculatedLeft = targetRect.left - calloutWidth - padding;
      calculatedTop = targetRect.top + (targetRect.height / 2) - (estimatedCalloutHeight / 2);
    } else if (pos === 'top') {
      calculatedTop = targetRect.top - estimatedCalloutHeight - padding;
      calculatedLeft = targetRect.left + (targetRect.width / 2) - (calloutWidth / 2);
    } else {
      // bottom
      calculatedTop = targetRect.bottom + padding;
      calculatedLeft = targetRect.left + (targetRect.width / 2) - (calloutWidth / 2);
    }

    // Absolute screen clamp: GUARANTEE that the callout is ALWAYS inside viewport bounds!
    const clampedTop = Math.max(16, Math.min(windowHeight - estimatedCalloutHeight - 16, calculatedTop));
    const clampedLeft = Math.max(16, Math.min(windowWidth - calloutWidth - 16, calculatedLeft));

    return {
      top: `${clampedTop}px`,
      left: `${clampedLeft}px`,
      maxWidth: `${Math.min(calloutWidth, windowWidth - 32)}px`,
      width: '100%'
    };
  };

  return (
    <>
      {/* 1. FIRST TIME LOGIN WELCOME PROMPT MODAL */}
      {showWelcomeModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200 select-none">
          <div className="glass-card max-w-md w-full rounded-3xl p-6 sm:p-7 space-y-5 bg-white/95 border border-white shadow-2xl relative overflow-hidden text-center">
            
            {/* Ambient background glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-orange-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#FF6B00] to-amber-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-orange-500/25 animate-bounce">
              <Compass className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-orange-100 text-orange-950 border border-orange-300">
                STRUCTURED ONBOARDING TOUR
              </span>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Welcome, {user?.username || 'User'}!
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Take a structured walkthrough to discover each menu, sub-menu, and operational feature step-by-step.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-[#FF6B00]" />
                <span>Structured Learning Flow:</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1.5 pl-5 list-disc font-medium">
                <li><strong className="text-slate-800">Timesheet Module</strong>: Daily Entry, 10h fill, Activity Log &amp; User Settings</li>
                <li><strong className="text-slate-800">Audit Log Module</strong>: Personal activity &amp; security trail</li>
                <li><strong className="text-slate-800">Collaboration &amp; Security</strong>: Realtime team chat &amp; AI Face ID</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleStartTour}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold btn-orange shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Guided Tour</span>
              </button>

              <button
                type="button"
                onClick={handleDismissWelcome}
                className="py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer active:scale-95"
              >
                Maybe Later
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. INTERACTIVE SPOTLIGHT TOUR OVERLAY WITH CRYSTAL CLEAR CUTOUT */}
      {isTourActive && (
        <div className="fixed inset-0 z-[9990] pointer-events-none select-none">
          
          {/* Crystal Clear Spotlight Box (Dimming all around it without blurring the target element) */}
          {targetRect ? (
            <div
              className="fixed pointer-events-none transition-all duration-300 ease-out rounded-2xl ring-4 ring-[#FF6B00] ring-offset-2 ring-offset-white/20 shadow-[0_0_0_9999px_rgba(15,23,42,0.72),0_0_40px_rgba(255,107,0,0.6)] z-[9991]"
              style={{
                top: `${Math.max(0, targetRect.top - 6)}px`,
                left: `${Math.max(0, targetRect.left - 6)}px`,
                width: `${targetRect.width + 12}px`,
                height: `${targetRect.height + 12}px`
              }}
            >
              {/* Pulsing corner highlight dots */}
              <span className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-[#FF6B00] animate-ping" />
              <span className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-[#FF6B00]" />
            </div>
          ) : (
            /* Fallback dark overlay when target element is transitioning */
            <div className="fixed inset-0 bg-slate-900/70 pointer-events-auto transition-opacity duration-300" />
          )}

          {/* Floating Interactive Callout Card with Typewriter Effect */}
          <div
            className="fixed pointer-events-auto z-[9995] animate-in fade-in zoom-in-95 duration-200 transition-all"
            style={getCalloutStyle()}
          >
            <div className="glass-card rounded-3xl p-5 sm:p-6 space-y-4 bg-white/95 border-2 border-orange-500/40 shadow-2xl shadow-slate-900/50 text-slate-800 relative overflow-hidden backdrop-blur-xl">
              
              {/* Header: Step Tag & Counter */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-black bg-orange-100 text-[#FF6B00] border border-orange-200 uppercase tracking-wider">
                    {currentStep.tag}
                  </span>
                  <span className="text-[10px] font-bold font-mono text-slate-400">
                    Step {currentStepIndex + 1} of {TOUR_STEPS.length}
                  </span>
                </div>

                <button
                  onClick={handleFinishTour}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  title="Close / Exit Tour"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step Title & Icon */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#FF6B00] border border-orange-200 flex items-center justify-center shrink-0 shadow-2xs">
                  {React.createElement(currentStep.icon, { className: 'w-4 h-4' })}
                </div>
                <h4 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
                  {currentStep.title}
                </h4>
              </div>

              {/* Typewriter Explanation Content */}
              <div 
                onClick={completeTypingInstantly}
                className="p-3.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed min-h-[92px] cursor-pointer hover:border-orange-300 transition-colors relative group"
                title={isTyping ? "Click to reveal full text immediately" : ""}
              >
                <p>
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#FF6B00] animate-pulse align-middle" />
                  )}
                </p>
                {isTyping && (
                  <span className="absolute bottom-1.5 right-2 text-[9px] font-mono text-slate-400 group-hover:text-[#FF6B00] transition-colors">
                    click to reveal
                  </span>
                )}
              </div>

              {/* Progress dots bar */}
              <div className="flex items-center justify-center gap-1.5 py-1">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentStepIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentStepIndex
                        ? 'w-6 bg-[#FF6B00]'
                        : idx < currentStepIndex
                        ? 'w-2 bg-orange-200 hover:bg-orange-300'
                        : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                    title={`Jump to Step ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Tour Controls (Previous, Next, Finish) */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={handlePrevStep}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFinishTour}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  >
                    Skip Tour
                  </button>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-4 py-2 rounded-xl text-xs font-extrabold btn-orange shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}</span>
                    {currentStepIndex === TOUR_STEPS.length - 1 ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}
    </>
  );
}
