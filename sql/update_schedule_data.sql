-- 1. Update ALL records to include breakActive: true in schedule data
UPDATE public.business_hours
SET weekly_schedule = '[
    {"day": "Monday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00", "breakActive": true, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Tuesday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00", "breakActive": true, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Wednesday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00", "breakActive": true, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Thursday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00", "breakActive": true, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Friday", "endTime": "17:00", "hasBreak": true, "isActive": true, "startTime": "08:00", "breakActive": true, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Saturday", "endTime": "17:00", "hasBreak": true, "isActive": false, "isClosed": true, "breakActive": false, "breakEndTime": "13:00", "breakStartTime": "12:00"},
    {"day": "Sunday", "endTime": "17:00", "hasBreak": true, "isActive": false, "isClosed": true, "breakActive": false, "breakEndTime": "13:00", "breakStartTime": "12:00"}
]'::jsonb;
