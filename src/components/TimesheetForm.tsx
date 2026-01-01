import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "./ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/form";
import { Input } from "./ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { useState, useEffect } from "react";
import { ProjectSelect } from "./ProjectSelect";
import { useProfile } from "@/hooks/useProfile";
import { Alert, AlertDescription } from "./ui/alert";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  employee_id: z.string().min(1, "Employee ID is required").max(50),
  project: z.string().min(1, "Please select a project"),
  hours: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0 && Number(val) <= 24, {
    message: "Hours must be between 0 and 24",
  }),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().min(1, "End date is required"),
}).refine((data) => new Date(data.end_date) >= new Date(data.start_date), {
  message: "End date must be after or equal to start date",
  path: ["end_date"],
});

interface TimesheetFormProps {
  onSuccess?: () => void;
}

export const TimesheetForm = ({ onSuccess }: TimesheetFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { profile, loading: profileLoading, updateProfile } = useProfile();

  const today = new Date().toISOString().split("T")[0];
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      employee_id: "",
      project: "",
      hours: "",
      start_date: today,
      end_date: today,
    },
  });

  // Auto-fill name and employee_id from profile
  useEffect(() => {
    if (profile) {
      if (profile.display_name) {
        form.setValue("name", profile.display_name);
      }
      if (profile.employee_id) {
        form.setValue("employee_id", profile.employee_id);
      }
    }
  }, [profile, form]);

  const hasProfileData = profile?.display_name && profile?.employee_id;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error("You must be logged in to submit a timesheet");
        return;
      }

      // Save name and employee_id to profile if not already saved
      if (!profile?.display_name || !profile?.employee_id) {
        await updateProfile({
          display_name: values.name.trim(),
          employee_id: values.employee_id.trim(),
        });
      }

      const { error } = await supabase.from("timesheets").insert([
        {
          user_id: user.id,
          name: values.name.trim(),
          employee_id: values.employee_id.trim(),
          project: values.project,
          hours: parseFloat(values.hours),
          start_date: values.start_date,
          end_date: values.end_date,
        },
      ]);

      if (error) throw error;

      toast.success("Timesheet entry created successfully!");
      form.reset({
        name: values.name,
        employee_id: values.employee_id,
        project: "",
        hours: "",
        start_date: today,
        end_date: today,
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error creating timesheet:", error);
      toast.error("Failed to create timesheet entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {hasProfileData && (
          <Alert className="bg-primary/5 border-primary/20">
            <User className="h-4 w-4" />
            <AlertDescription>
              Name and Employee ID auto-filled from your profile.
            </AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="employee_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Employee ID</FormLabel>
                <FormControl>
                  <Input placeholder="EMP001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="project"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project</FormLabel>
                <FormControl>
                  <ProjectSelect
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="hours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hours Worked</FormLabel>
                <FormControl>
                  <Input type="number" step="0.5" placeholder="8" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="start_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Timesheet"
          )}
        </Button>
      </form>
    </Form>
  );
};