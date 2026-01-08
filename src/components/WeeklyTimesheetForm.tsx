import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, Plus, Trash2, Save } from "lucide-react";
import { ProjectSelect } from "./ProjectSelect";
import { useProfile } from "@/hooks/useProfile";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks } from "date-fns";

interface WeeklyEntry {
  id: string;
  project: string;
  description: string;
  hours: { [key: string]: number }; // day -> hours
}

interface SavedDraft {
  entries: WeeklyEntry[];
  weekStart: string;
}

interface WeeklyTimesheetFormProps {
  onSuccess?: () => void;
}

const DRAFT_STORAGE_KEY = 'timesheet_draft';

export const WeeklyTimesheetForm = ({ onSuccess }: WeeklyTimesheetFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { profile, loading: profileLoading } = useProfile();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday start
  );
  
  const [entries, setEntries] = useState<WeeklyEntry[]>([
    { id: crypto.randomUUID(), project: "", description: "", hours: {} }
  ]);

  // Load saved draft on mount
  useEffect(() => {
    loadDraft();
  }, []);

  // Load draft when week changes
  useEffect(() => {
    loadDraft();
  }, [currentWeekStart]);

  const loadDraft = () => {
    try {
      const weekKey = format(currentWeekStart, "yyyy-MM-dd");
      const savedData = localStorage.getItem(`${DRAFT_STORAGE_KEY}_${weekKey}`);
      if (savedData) {
        const draft: SavedDraft = JSON.parse(savedData);
        if (draft.entries && draft.entries.length > 0) {
          setEntries(draft.entries);
          return;
        }
      }
      // Reset to empty if no draft
      setEntries([{ id: crypto.randomUUID(), project: "", description: "", hours: {} }]);
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  };

  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const weekKey = format(currentWeekStart, "yyyy-MM-dd");
      const draft: SavedDraft = {
        entries,
        weekStart: weekKey,
      };
      localStorage.setItem(`${DRAFT_STORAGE_KEY}_${weekKey}`, JSON.stringify(draft));
      toast.success("Draft saved successfully!");
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  const clearDraft = () => {
    const weekKey = format(currentWeekStart, "yyyy-MM-dd");
    localStorage.removeItem(`${DRAFT_STORAGE_KEY}_${weekKey}`);
  };

  // Generate week days
  const weekDays = Array.from({ length: 6 }, (_, i) => addDays(currentWeekStart, i)); // Mon-Sat
  const weekEnd = addDays(currentWeekStart, 5); // Saturday

  const goToPreviousWeek = () => {
    setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  };

  const addEntry = () => {
    setEntries([...entries, { id: crypto.randomUUID(), project: "", description: "", hours: {} }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: keyof WeeklyEntry, value: any) => {
    setEntries(entries.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  const updateHours = (entryId: string, dayKey: string, hours: number) => {
    setEntries(entries.map(e => 
      e.id === entryId 
        ? { ...e, hours: { ...e.hours, [dayKey]: Math.min(24, Math.max(0, hours)) } }
        : e
    ));
  };

  const getTotalHours = (entry: WeeklyEntry): number => {
    return Object.values(entry.hours).reduce((sum, h) => sum + (h || 0), 0);
  };

  const getDayTotal = (dayKey: string): number => {
    return entries.reduce((sum, e) => sum + (e.hours[dayKey] || 0), 0);
  };

  const getWeekTotal = (): number => {
    return entries.reduce((sum, e) => sum + getTotalHours(e), 0);
  };

  const onSubmit = async () => {
    if (!profile?.display_name || !profile?.employee_id) {
      toast.error("Your profile must have name and employee ID set");
      return;
    }

    // Validate entries
    const validEntries = entries.filter(e => e.project && getTotalHours(e) > 0);
    if (validEntries.length === 0) {
      toast.error("Please add at least one project with hours");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to submit a timesheet");
        return;
      }

      // Create individual timesheet entries for each day with hours
      const timesheetEntries = [];
      for (const entry of validEntries) {
        for (const [dayKey, hours] of Object.entries(entry.hours)) {
          if (hours > 0) {
            timesheetEntries.push({
              user_id: user.id,
              name: profile.display_name,
              employee_id: profile.employee_id,
              project: entry.project,
              hours: hours,
              start_date: dayKey,
              end_date: dayKey,
            });
          }
        }
      }

      if (timesheetEntries.length === 0) {
        toast.error("No valid hours to submit");
        return;
      }

      const { error } = await supabase.from("timesheets").insert(timesheetEntries);

      if (error) throw error;

      toast.success(`Successfully submitted ${timesheetEntries.length} timesheet entries!`);
      
      // Clear draft after successful submission
      clearDraft();
      
      // Reset form
      setEntries([{ id: crypto.randomUUID(), project: "", description: "", hours: {} }]);
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error creating timesheet:", error);
      toast.error("Failed to submit timesheet");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const missingProfile = !profile?.display_name || !profile?.employee_id;

  return (
    <div className="space-y-6">
      {/* User Info Display */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="text-sm text-muted-foreground">Employee Name</span>
              <p className="font-medium">{profile?.display_name || "Not set"}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Employee ID</span>
              <p className="font-medium">{profile?.employee_id || "Not set"}</p>
            </div>
          </div>
          {missingProfile && (
            <p className="text-destructive text-sm mt-2">
              Please update your profile with name and employee ID before submitting timesheets.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-center">
          <h3 className="font-semibold text-lg">
            {format(currentWeekStart, "dd MMM")} - {format(weekEnd, "dd MMM yyyy")}
          </h3>
        </div>
        <Button variant="outline" size="icon" onClick={goToNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Timesheet Grid */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 min-w-[180px]">Project</th>
              <th className="text-left p-2 min-w-[140px]">Task Description</th>
              {weekDays.map(day => (
                <th key={day.toISOString()} className="text-center p-2 w-[70px]">
                  <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                  <div className="font-semibold">{format(day, "dd")}</div>
                </th>
              ))}
              <th className="text-center p-2 w-[60px]">Total</th>
              <th className="p-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b">
                <td className="p-2">
                  <ProjectSelect
                    value={entry.project}
                    onValueChange={(val) => updateEntry(entry.id, "project", val)}
                    disabled={isSubmitting}
                  />
                </td>
                <td className="p-2">
                  <Input
                    placeholder="Task description"
                    value={entry.description}
                    onChange={(e) => updateEntry(entry.id, "description", e.target.value)}
                    disabled={isSubmitting}
                    className="min-w-[120px]"
                  />
                </td>
                {weekDays.map(day => {
                  const dayKey = format(day, "yyyy-MM-dd");
                  return (
                    <td key={dayKey} className="p-1">
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        placeholder="0"
                        value={entry.hours[dayKey] || ""}
                        onChange={(e) => updateHours(entry.id, dayKey, parseFloat(e.target.value) || 0)}
                        disabled={isSubmitting}
                        className="text-center w-[60px] px-1"
                      />
                    </td>
                  );
                })}
                <td className="p-2 text-center font-medium">
                  {getTotalHours(entry).toFixed(1)}
                </td>
                <td className="p-2">
                  {entries.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEntry(entry.id)}
                      disabled={isSubmitting}
                      className="text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {/* Totals Row */}
            <tr className="bg-muted/50 font-medium">
              <td colSpan={2} className="p-2 text-right">Daily Total:</td>
              {weekDays.map(day => {
                const dayKey = format(day, "yyyy-MM-dd");
                return (
                  <td key={dayKey} className="p-2 text-center">
                    {getDayTotal(dayKey).toFixed(1)}
                  </td>
                );
              })}
              <td className="p-2 text-center text-primary font-bold">
                {getWeekTotal().toFixed(1)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add Entry Button */}
      <Button variant="outline" onClick={addEntry} disabled={isSubmitting} className="gap-2">
        <Plus className="h-4 w-4" />
        Add Time Entry
      </Button>

      {/* Save and Submit Buttons */}
      <div className="flex flex-wrap justify-end gap-4">
        <Button 
          variant="outline"
          onClick={saveDraft} 
          disabled={isSaving || isSubmitting}
          className="gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Draft
            </>
          )}
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting || missingProfile}
          size="lg"
          className="min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Weekly Timesheet"
          )}
        </Button>
      </div>
    </div>
  );
};
