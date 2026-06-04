import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Shuffle, HelpCircle, Globe } from "lucide-react";

interface PairsGameModeSelectionProps {
  onBack: () => void;
  onSelectRandom: () => void;
  onSelectTierQuestion: () => void;
  onSelectWorldCup26: () => void;
}

export const PairsGameModeSelection = ({
  onBack,
  onSelectRandom,
  onSelectTierQuestion,
  onSelectWorldCup26,
}: PairsGameModeSelectionProps) => {
  return (
    <div className="min-h-screen bg-gaming-bg p-4" dir="rtl">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5 rotate-180" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">בחירת מצב קבוצות</h1>
            <p className="text-sm text-muted-foreground">איך לחלק קבוצות לזוגות?</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Random Mode */}
          <Card 
            className="bg-gradient-card border-neon-green/30 p-6 cursor-pointer hover:border-neon-green/60 transition-all hover:scale-[1.02]"
            onClick={onSelectRandom}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-neon-green/20">
                <Shuffle className="h-6 w-6 text-neon-green" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground mb-1">רנדומלי</h2>
                <p className="text-sm text-muted-foreground">
                  המערכת תחלק קבוצות באופן אוטומטי ומאוזן לשני הזוגות
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gaming-surface px-2 py-1 rounded-md text-muted-foreground">
                    ⚡ מהיר
                  </span>
                  <span className="text-xs bg-gaming-surface px-2 py-1 rounded-md text-muted-foreground">
                    🎲 אקראי
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Tier Question Mode */}
          <Card 
            className="bg-gradient-card border-neon-purple/30 p-6 cursor-pointer hover:border-neon-purple/60 transition-all hover:scale-[1.02]"
            onClick={onSelectTierQuestion}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-neon-purple/20">
                <HelpCircle className="h-6 w-6 text-neon-purple" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground mb-1">שאלות טריוויה</h2>
                <p className="text-sm text-muted-foreground">
                  ענו על שאלות כדורגל כדי לזכות בבחירת קבוצה מכל דירוג כוכבים
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs bg-gaming-surface px-2 py-1 rounded-md text-muted-foreground">
                    🧠 מיומנות
                  </span>
                  <span className="text-xs bg-gaming-surface px-2 py-1 rounded-md text-muted-foreground">
                    🏆 יתרון לזוכה
                  </span>
                  <span className="text-xs bg-gaming-surface px-2 py-1 rounded-md text-muted-foreground">
                    ⚖️ הוגן
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Info Box */}
          <div className="bg-gaming-surface/50 rounded-lg p-4 border border-border/50">
            <h3 className="text-sm font-medium text-foreground mb-2">📋 מצב שאלות טריוויה</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• בכל דירוג כוכבים תוצג שאלה מספרית</li>
              <li>• הזוג עם הניחוש הקרוב לתשובה בוחר קבוצה אחת</li>
              <li>• שאר הקבוצות מחולקות באופן מאוזן</li>
              <li>• בתיקו - שאלה נוספת עד שיש מנצח</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
