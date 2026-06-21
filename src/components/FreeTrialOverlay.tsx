import { motion } from "framer-motion";
import { Lock, MessageCircle, CreditCard } from "lucide-react";

interface FreeTrialOverlayProps {
  remainingSeconds: number;
  trialExpired: boolean;
}

export const FreeTrialOverlay = ({ remainingSeconds, trialExpired }: FreeTrialOverlayProps) => {
  if (trialExpired) {
    const whatsappMessage = encodeURIComponent(
      "Habari Admin, nimefanya malipo ya Premium. Hii hapa ni namba yangu ya muamala: "
    );

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 z-20 bg-black/95 flex items-center justify-center overflow-y-auto"
      >
        <div className="text-center px-5 py-6 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[hsl(45,90%,50%)]/20 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-[hsl(45,90%,50%)]" />
          </div>

          <h3 className="text-lg font-black text-[hsl(45,90%,50%)] mb-2">
            💎 Jiunge na Uhuru Stream Premium!
          </h3>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Samahani, burudani hii ni maalum kwa wanachama wetu wa Premium tu. Trial yako ya bure imekwisha.
          </p>

          <p className="text-sm text-foreground mb-4 leading-relaxed">
            Kwa kulipia <span className="font-bold text-[hsl(45,90%,50%)]">Tsh 5,000</span> tu kwa mwezi, utapata:
          </p>

          <div className="text-left bg-card/30 rounded-xl p-3 mb-4 space-y-1.5">
            <p className="text-sm text-foreground">✅ Mechi zote za EPL, La Liga, Live</p>
            <p className="text-sm text-foreground">✅ Movies bila matangazo</p>
            <p className="text-sm text-foreground">✅ Channel zote za Premium</p>
          </div>

          {/* Payment Details */}
          <div className="bg-card/30 rounded-xl p-3 mb-4 text-left space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground uppercase">Njia za Malipo:</span>
            </div>
            <div className="text-sm text-foreground">
              <p className="font-semibold">Tigo Pesa:</p>
              <p className="text-muted-foreground">0778018545 - Hellena luhwago</p>
            </div>
            <div className="text-sm text-foreground">
              <p className="font-semibold">Mpesa:</p>
              <p className="text-muted-foreground">0795906721 - Hellena luhwago</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 italic">
              Huduma itawashwa ndani ya dakika 5-10 baada ya uhakiki.
            </p>
          </div>

          <a
            href={`https://wa.me/255778018545?text=${whatsappMessage}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,40%)] text-white font-semibold px-6 py-3 rounded-lg transition-colors w-full justify-center"
          >
            <MessageCircle className="w-5 h-5" />
            Confirm Payment via WhatsApp
          </a>

          <p className="text-xs text-muted-foreground mt-3">+255 778 018 545</p>
        </div>
      </motion.div>
    );
  }

  // Show timer badge during trial
  return (
    <div className="absolute top-2 right-2 z-20">
      <div className="bg-primary/90 text-primary-foreground text-[10px] font-bold px-2 py-1 rounded-full">
        Trial: {Math.floor(remainingSeconds)}s
      </div>
    </div>
  );
};
