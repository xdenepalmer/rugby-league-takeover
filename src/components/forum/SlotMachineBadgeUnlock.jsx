import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

// Slot machine reel symbols
const SYMBOLS = [
  { emoji: "🍒", label: "Cherry" },
  { emoji: "🍋", label: "Lemon" },
  { emoji: "🔔", label: "Bell" },
  { emoji: "💎", label: "Diamond" },
  { emoji: "🏉", label: "Footy" },
  { emoji: "🎰", label: "Jackpot" }
];

export default function SlotMachineBadgeUnlock() {
  const [reels, setReels] = useState(["🎰", "🎰", "🎰"]);
  const [spinning, setSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [message, setMessage] = useState("Spin the slot to unlock Vegas Fan Badges!");
  const [isJackpot, setIsJackpot] = useState(false);
  const [unlockedSpins, setUnlockedSpins] = useState(() => !!localStorage.getItem("rlt_slot_spins"));
  const [unlockedJackpot, setUnlockedJackpot] = useState(() => !!localStorage.getItem("rlt_slot_jackpot"));
  
  // Audio Context Ref
  const audioCtxRef = useRef(null);

  // Initialize Audio Context on demand (user interaction)
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  // Play retro synth beep
  const playBeep = (freq, duration, type = "sine") => {
    if (!soundEnabled) return;
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn("Web Audio failed:", e);
    }
  };

  // Play victory jackpot sound
  const playVictorySound = () => {
    if (!soundEnabled) return;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C major arpeggio
    notes.forEach((freq, index) => {
      setTimeout(() => {
        playBeep(freq, 0.45, "square");
      }, index * 120);
    });
  };

  // Play loss buzzer sound
  const playBuzzerSound = () => {
    if (!soundEnabled) return;
    playBeep(180, 0.3, "sawtooth");
    setTimeout(() => {
      playBeep(140, 0.4, "sawtooth");
    }, 150);
  };

  const handleSpin = () => {
    if (spinning) return;
    
    initAudio();
    setSpinning(true);
    setIsJackpot(false);
    setMessage("Spinning the Reels...");
    
    // Set spins unlock in localstorage
    localStorage.setItem("rlt_slot_spins", "true");
    setUnlockedSpins(true);
    // Dispatch local event to refresh achievements component
    window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_spin" } }));

    // Sound effect: reel spinning sounds (rapid ticking)
    let spinTickCount = 0;
    const tickInterval = setInterval(() => {
      if (spinTickCount < 8) {
        playBeep(330 + (spinTickCount * 40), 0.08, "triangle");
        spinTickCount++;
      } else {
        clearInterval(tickInterval);
      }
    }, 120);

    // Dynamic reel randomization over time
    const duration = 1200;
    const start = Date.now();
    
    const animateReels = () => {
      const elapsed = Date.now() - start;
      if (elapsed < duration) {
        setReels([
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji,
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji,
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji
        ]);
        requestAnimationFrame(animateReels);
      } else {
        // Final outcomes
        const finalReels = [
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji,
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji,
          SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji
        ];
        
        // Custom odds: let's make it 25% chance to win something, and 10% chance of a perfect 3-of-a-kind jackpot
        const roll = Math.random();
        if (roll < 0.15) {
          // Force perfect 3-of-a-kind jackpot
          const winSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji;
          finalReels[0] = winSym;
          finalReels[1] = winSym;
          finalReels[2] = winSym;
        } else if (roll < 0.35) {
          // Force 2 matching elements
          const winSym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].emoji;
          finalReels[0] = winSym;
          finalReels[1] = winSym;
        }

        setReels(finalReels);
        setSpinning(false);

        // Evaluate victory condition
        const isWin = finalReels[0] === finalReels[1] && finalReels[1] === finalReels[2];
        const isTwoOfKind = finalReels[0] === finalReels[1] || finalReels[1] === finalReels[2] || finalReels[0] === finalReels[2];

        if (isWin) {
          playVictorySound();
          setIsJackpot(true);
          localStorage.setItem("rlt_slot_jackpot", "true");
          setUnlockedJackpot(true);
          setMessage(`🎉 JACKPOT! 3x ${finalReels[0]} - You unlocked the Jackpot Winner Badge!`);
          window.dispatchEvent(new CustomEvent("rlt_badge_event", { detail: { action: "slot_jackpot" } }));
        } else if (isTwoOfKind) {
          playBeep(523.25, 0.15, "sine");
          setTimeout(() => playBeep(659.25, 0.25, "sine"), 100);
          setMessage(`✨ Good spin! 2x ${finalReels[0] === finalReels[1] ? finalReels[0] : finalReels[1]} - Unlocked High Roller Badge!`);
        } else {
          playBuzzerSound();
          setMessage("Try again! Spin to match symbols and unlock badges.");
        }
      }
    };

    requestAnimationFrame(animateReels);
  };

  return (
    <div className="border border-border/65 bg-card/30 cmd-glass overflow-hidden">
      <div className="h-[2px] w-full bg-gradient-to-r from-pink-500 via-primary to-pink-500" />
      <div className="p-4 sm:p-5">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-pink-500/10 border border-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.15)]">
              <span className="text-sm">🎰</span>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Vegas Slot Machine</h3>
              <p className="text-[8px] font-mono uppercase tracking-wider text-pink-400">Unlock Premium Badges</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 border border-border/40 bg-neutral-900/60"
            title={soundEnabled ? "Mute Sounds" : "Unmute Sounds"}
          >
            {soundEnabled ? <Volume2 className="h-3 w-3 text-pink-400" /> : <VolumeX className="h-3 w-3" />}
          </button>
        </div>

        {/* Slot Window Frame */}
        <div className="relative border border-border/80 bg-neutral-950 p-4 shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] overflow-hidden">
          {/* Neon lights visual borders */}
          <div className="absolute inset-0 pointer-events-none border border-pink-500/20" />
          
          {/* Reels Display */}
          <div className="grid grid-cols-3 gap-3 relative z-10">
            {reels.map((emoji, index) => (
              <div 
                key={index} 
                className="h-16 flex items-center justify-center border border-border/60 bg-neutral-900 shadow-[0_4px_12px_rgba(0,0,0,0.8)] relative overflow-hidden"
              >
                {/* Horizontal guide line */}
                <div className="absolute left-0 right-0 h-[1px] bg-pink-500/10 top-1/2 -translate-y-1/2 pointer-events-none" />
                
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${emoji}_${index}_${spinning}`}
                    initial={{ y: spinning ? -30 : 0, opacity: spinning ? 0.3 : 1 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: spinning ? 30 : 0, opacity: 0.3 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                    className="text-3xl filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] select-none"
                  >
                    {emoji}
                  </motion.span>
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Decorative Las Vegas Jackpot flashing crown */}
          {isJackpot && (
            <div className="absolute inset-0 pointer-events-none bg-pink-500/[0.04] animate-pulse flex items-center justify-center">
              <div className="text-[9px] font-mono text-pink-400 font-extrabold uppercase border border-pink-500 bg-black px-2 py-0.5 animate-bounce">
                🎉 JACKPOT 🎉
              </div>
            </div>
          )}
        </div>

        {/* Status message */}
        <p className={`text-[10px] text-center font-mono mt-3 ${isJackpot ? "text-pink-400 font-bold" : "text-slate-300"}`}>
          {message}
        </p>

        {/* Action button */}
        <div className="mt-3">
          <Button
            type="button"
            disabled={spinning}
            onClick={handleSpin}
            className={`w-full rounded-none text-[10px] font-bold uppercase tracking-widest font-mono h-9 select-none transition-all ${
              spinning 
                ? "bg-neutral-800 text-slate-500 border border-border"
                : "bg-gradient-to-r from-pink-600 via-primary to-pink-600 hover:from-pink-500 hover:to-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.35)] hover:shadow-[0_0_18px_rgba(236,72,153,0.55)]"
            }`}
          >
            {spinning ? (
              <span className="flex items-center justify-center gap-1.5">
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
                Spinning...
              </span>
            ) : (
              "PULL THE LEVER"
            )}
          </Button>
        </div>

        {/* Badges Earned Summary */}
        <div className="mt-3.5 pt-3 border-t border-border/30 flex justify-between items-center">
          <span className="text-[8px] font-mono text-slate-400 uppercase">Badges:</span>
          <div className="flex gap-2">
            <span 
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                unlockedSpins 
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                  : "bg-neutral-900 border-border/30 text-slate-500"
              }`}
              title="Unlocked by spinning the Vegas Slot Machine"
            >
              🎰 High Roller
            </span>
            <span 
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider border ${
                unlockedJackpot 
                  ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse" 
                  : "bg-neutral-900 border-border/30 text-slate-500"
              }`}
              title="Unlocked by getting a 3x match jackpot"
            >
              🔥 Jackpot Winner
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
