-- Church users are assigned to their church before accepting the emailed
-- password invitation. Both pending and active church users therefore have
-- exactly one tenant membership.
CREATE OR REPLACE FUNCTION "check_user_actor_assignment"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_user_ids UUID[];
    target_user_id UUID;
    target_actor_state "user_actor_state";
    assignment_count INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'users' THEN
            target_user_ids := ARRAY[NEW."id"];
        ELSE
            target_user_ids := ARRAY[NEW."user_id"];
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'users' THEN
            target_user_ids := ARRAY[OLD."id"];
        ELSE
            target_user_ids := ARRAY[OLD."user_id"];
        END IF;
    ELSIF TG_TABLE_NAME = 'users' THEN
        target_user_ids := ARRAY[NEW."id", OLD."id"];
    ELSE
        target_user_ids := ARRAY[NEW."user_id", OLD."user_id"];
    END IF;

    FOREACH target_user_id IN ARRAY target_user_ids LOOP
        SELECT "actor_state" INTO target_actor_state
          FROM "users"
         WHERE "id" = target_user_id
           FOR UPDATE;

        IF FOUND THEN
            SELECT count(*) FROM "church_memberships" WHERE "user_id" = target_user_id
              INTO assignment_count;

            IF (target_actor_state = 'ACTIVE' AND assignment_count <> 1)
               OR (target_actor_state = 'PENDING' AND assignment_count > 1) THEN
                RAISE EXCEPTION 'invalid actor assignment for user'
                    USING ERRCODE = '23514', CONSTRAINT = 'actor_assignment_ck';
            END IF;
        END IF;
    END LOOP;
    RETURN NULL;
END;
$$;
