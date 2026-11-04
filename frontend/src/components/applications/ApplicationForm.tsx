import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Application,
  ApplicationCreateInput,
  ApplicationStatus,
  EmploymentType,
  WorkMode,
} from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';

const formSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  job_title: z.string().min(1, 'Job title is required'),
  application_status: z.enum([
    'Wishlist',
    'Applied',
    'Assessment',
    'Interview',
    'Offer',
    'Rejected',
    'NoResponse',
  ]),
  is_favorite: z.boolean().optional(),
  company_website: z.string().optional(),
  job_url: z.string().optional(),
  location: z.string().optional(),
  work_mode: z.enum(['Remote', 'Hybrid', 'Onsite']).optional(),
  employment_type: z
    .enum(['FullTime', 'PartTime', 'Contract', 'Internship', 'Freelance'])
    .optional(),
  salary_range: z.string().optional(),
  experience_required: z.string().optional(),
  required_skills: z.string().optional(),
  application_source: z.string().optional(),
  date_discovered: z.string().optional(),
  date_applied: z.string().optional(),
  recruiter_name: z.string().optional(),
  recruiter_email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  follow_up_date: z.string().optional(),
  resume_version: z.string().optional(),
  match_score: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  job_description: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Application | null;
  onSubmit: (data: ApplicationCreateInput) => Promise<void>;
}

export const ApplicationForm: React.FC<ApplicationFormProps> = ({
  open,
  onOpenChange,
  initialData,
  onSubmit,
}) => {
  const isEditing = Boolean(initialData);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: '',
      job_title: '',
      application_status: 'Wishlist',
      is_favorite: false,
      company_website: '',
      job_url: '',
      location: '',
      work_mode: 'Remote',
      employment_type: 'FullTime',
      salary_range: '',
      experience_required: '',
      required_skills: '',
      application_source: 'LinkedIn',
      date_discovered: new Date().toISOString().split('T')[0],
      date_applied: '',
      recruiter_name: '',
      recruiter_email: '',
      follow_up_date: '',
      resume_version: '',
      match_score: 0,
      notes: '',
      job_description: '',
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        company_name: initialData.company_name || '',
        job_title: initialData.job_title || '',
        application_status: initialData.application_status || 'Wishlist',
        is_favorite: Boolean(initialData.is_favorite),
        company_website: initialData.company_website || '',
        job_url: initialData.job_url || '',
        location: initialData.location || '',
        work_mode: initialData.work_mode || 'Remote',
        employment_type: initialData.employment_type || 'FullTime',
        salary_range: initialData.salary_range || '',
        experience_required: initialData.experience_required || '',
        required_skills: Array.isArray(initialData.required_skills)
          ? initialData.required_skills.join(', ')
          : '',
        application_source: initialData.application_source || '',
        date_discovered: initialData.date_discovered || '',
        date_applied: initialData.date_applied || '',
        recruiter_name: initialData.recruiter_name || '',
        recruiter_email: initialData.recruiter_email || '',
        follow_up_date: initialData.follow_up_date || '',
        resume_version: initialData.resume_version || '',
        match_score: initialData.match_score ?? 0,
        notes: initialData.notes || '',
        job_description: initialData.job_description || '',
      });
    } else {
      reset({
        company_name: '',
        job_title: '',
        application_status: 'Wishlist',
        is_favorite: false,
        company_website: '',
        job_url: '',
        location: '',
        work_mode: 'Remote',
        employment_type: 'FullTime',
        salary_range: '',
        experience_required: '',
        required_skills: '',
        application_source: 'LinkedIn',
        date_discovered: new Date().toISOString().split('T')[0],
        date_applied: '',
        recruiter_name: '',
        recruiter_email: '',
        follow_up_date: '',
        resume_version: '',
        match_score: 0,
        notes: '',
        job_description: '',
      });
    }
  }, [initialData, reset, open]);

  const onFormSubmit = async (values: FormData) => {
    const cleanStr = (val?: string) => {
      if (!val) return undefined;
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    };

    const formattedData: ApplicationCreateInput = {
      company_name: values.company_name.trim(),
      job_title: values.job_title.trim(),
      application_status: values.application_status,
      is_favorite: Boolean(values.is_favorite),
      company_website: cleanStr(values.company_website),
      job_url: cleanStr(values.job_url),
      location: cleanStr(values.location),
      work_mode: values.work_mode || undefined,
      employment_type: values.employment_type || undefined,
      salary_range: cleanStr(values.salary_range),
      experience_required: cleanStr(values.experience_required),
      required_skills: values.required_skills
        ? values.required_skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      application_source: cleanStr(values.application_source),
      date_discovered: cleanStr(values.date_discovered),
      date_applied: cleanStr(values.date_applied),
      recruiter_name: cleanStr(values.recruiter_name),
      recruiter_email: cleanStr(values.recruiter_email),
      follow_up_date: cleanStr(values.follow_up_date),
      resume_version: cleanStr(values.resume_version),
      match_score:
        typeof values.match_score === 'number' && !isNaN(values.match_score) && values.match_score > 0
          ? values.match_score
          : undefined,
      notes: cleanStr(values.notes),
      job_description: cleanStr(values.job_description),
    };
    await onSubmit(formattedData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {isEditing ? 'Edit Job Application' : 'Add New Job Application'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4 pt-2">
          {/* Company & Job Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="company_name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="company_name"
                placeholder="e.g. Google, Stripe"
                {...register('company_name')}
              />
              {errors.company_name && (
                <p className="text-xs text-destructive">
                  {errors.company_name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="job_title">
                Job Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="job_title"
                placeholder="e.g. Senior Frontend Engineer"
                {...register('job_title')}
              />
              {errors.job_title && (
                <p className="text-xs text-destructive">
                  {errors.job_title.message}
                </p>
              )}
            </div>
          </div>

          {/* Favorite / High Priority Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/50">
            <div className="flex items-center gap-2.5">
              <Star className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0" />
              <div>
                <Label htmlFor="is_favorite" className="text-xs font-semibold cursor-pointer block">
                  Mark as Favorite Company (High Priority Target)
                </Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Elevates this role and company into your Favorites tab and priority tracking
                </p>
              </div>
            </div>
            <input
              type="checkbox"
              id="is_favorite"
              {...register('is_favorite')}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
          </div>

          {/* Status & Work Mode & Employment Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Application Status</Label>
              <Controller
                name="application_status"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as ApplicationStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Wishlist">Wishlist</SelectItem>
                      <SelectItem value="Applied">Applied</SelectItem>
                      <SelectItem value="Assessment">Assessment</SelectItem>
                      <SelectItem value="Interview">Interview</SelectItem>
                      <SelectItem value="Offer">Offer</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                      <SelectItem value="NoResponse">No Response</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Work Mode</Label>
              <Controller
                name="work_mode"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as WorkMode)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Remote">Remote</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="Onsite">Onsite</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Employment Type</Label>
              <Controller
                name="employment_type"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(val) => field.onChange(val as EmploymentType)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FullTime">Full Time</SelectItem>
                      <SelectItem value="PartTime">Part Time</SelectItem>
                      <SelectItem value="Contract">Contract</SelectItem>
                      <SelectItem value="Internship">Internship</SelectItem>
                      <SelectItem value="Freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* Location & Salary Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g. San Francisco, CA / Remote"
                {...register('location')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="salary_range">Salary Range</Label>
              <Input
                id="salary_range"
                placeholder="e.g. $130,000 - $160,000"
                {...register('salary_range')}
              />
            </div>
          </div>

          {/* Job URL & Company Website */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="job_url">Job Post URL</Label>
              <Input
                id="job_url"
                type="url"
                placeholder="https://..."
                {...register('job_url')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="company_website">Company Website</Label>
              <Input
                id="company_website"
                type="url"
                placeholder="https://..."
                {...register('company_website')}
              />
            </div>
          </div>

          {/* Dates: Discovered, Applied & Follow Up */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date_discovered">Date Discovered</Label>
              <Controller
                name="date_discovered"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="date_discovered"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Discovered date"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="date_applied">Date Applied</Label>
              <Controller
                name="date_applied"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="date_applied"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Date applied"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="follow_up_date">Follow-up Date</Label>
              <Controller
                name="follow_up_date"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="follow_up_date"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Follow-up date"
                  />
                )}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="match_score">Match Score (%)</Label>
              <Input
                id="match_score"
                type="number"
                min="0"
                max="100"
                placeholder="0 - 100"
                {...register('match_score')}
              />
            </div>
          </div>

          {/* Recruiter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="recruiter_name">Recruiter / Contact Name</Label>
              <Input
                id="recruiter_name"
                placeholder="e.g. Jane Doe"
                {...register('recruiter_name')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recruiter_email">Recruiter Email</Label>
              <Input
                id="recruiter_email"
                type="email"
                placeholder="recruiter@company.com"
                {...register('recruiter_email')}
              />
              {errors.recruiter_email && (
                <p className="text-xs text-destructive">
                  {errors.recruiter_email.message}
                </p>
              )}
            </div>
          </div>

          {/* Required Skills */}
          <div className="space-y-1.5">
            <Label htmlFor="required_skills">
              Required Skills (comma separated)
            </Label>
            <Input
              id="required_skills"
              placeholder="e.g. React, TypeScript, GraphQL, Tailwind CSS"
              {...register('required_skills')}
            />
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <Label htmlFor="job_description">Job Description / Requirements</Label>
            <Textarea
              id="job_description"
              rows={3}
              placeholder="Paste job details or summary here..."
              {...register('job_description')}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes / Referral Info / Next Steps</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Any additional thoughts or reminders..."
              {...register('notes')}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto font-semibold">
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Application'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
