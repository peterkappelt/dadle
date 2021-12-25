import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LinkOutlined,
  QuestionOutlined,
  WindowsOutlined
} from "@ant-design/icons";
import { useQuery } from "@apollo/client";
import { CHECK_CALENDAR_HEALTH } from "@operations/mutations/CheckCalendarHealth";
import { DELETE_CALENDAR } from "@operations/mutations/DeleteCalendar";
import { SET_CALENDAR_ENABLED } from "@operations/mutations/SetCalendarEnabled";
import {
  CheckCalendarHealth,
  CheckCalendarHealthVariables
} from "@operations/mutations/__generated__/CheckCalendarHealth";
import {
  DeleteCalendar,
  DeleteCalendarVariables
} from "@operations/mutations/__generated__/DeleteCalendar";
import {
  SetCalendarEnabled,
  SetCalendarEnabledVariables
} from "@operations/mutations/__generated__/SetCalendarEnabled";
import { GET_MY_CALENDARS } from "@operations/queries/GetMyCalendars";
import { GetMyCalendars } from "@operations/queries/__generated__/GetMyCalendars";
import { useStyledMutation } from "@util/mutationWrapper";
import {
  Avatar,
  Button,
  List,
  message,
  Popconfirm,
  Switch,
  Tooltip
} from "antd";
import React from "react";
import { useImmer } from "use-immer";

type TCalendarHealthCheck = {
  calId: string;
  loading?: boolean;
  healthy?: boolean | null;
};

const getIconForCalendarProvider = (provider: string) => {
  switch (provider) {
    case "microsoft":
      return <WindowsOutlined />;
    default:
      return <QuestionOutlined />;
  }
};

const getIconForHealthCheck = (checkResult?: TCalendarHealthCheck) => {
  if (!checkResult) return <LinkOutlined />;
  if (checkResult.healthy) return <CheckCircleOutlined />;
  return <CloseCircleOutlined />;
};

const CalendarList = () => {
  const { loading: calendarsLoading, data: calendarsData } =
    useQuery<GetMyCalendars>(GET_MY_CALENDARS);

  const [
    calendarsWithPendingEnabledChange,
    updateCalendarsWithPendingEnabledChange,
  ] = useImmer<string[]>([]); //ids of calendars currently being enabled/ disabled (loading state)
  const setCalendarEnabled = useStyledMutation<
    SetCalendarEnabled,
    SetCalendarEnabledVariables
  >(SET_CALENDAR_ENABLED, {
    successMessage: null,
  });

  const [calendarsBeingDeleted, updateCalendarsBeingDeleted] = useImmer<
    string[]
  >([]); //ids of calendars currently being deleted (loading state)
  const deleteCalender = useStyledMutation<
    DeleteCalendar,
    DeleteCalendarVariables
  >(DELETE_CALENDAR, { successMessage: "Kalender gelöscht!" });

  const [calendarHealthChecks, updateCalendarHealthChecks] = useImmer<
    TCalendarHealthCheck[]
  >([]);
  const checkCalendarHealth = useStyledMutation<
    CheckCalendarHealth,
    CheckCalendarHealthVariables
  >(CHECK_CALENDAR_HEALTH, { successMessage: null });
  const { getMyCalendars: calendars } = calendarsData || { getMyCalendars: [] };

  const onDeleteClick = async (calendarId: string) => {
    updateCalendarsBeingDeleted((l) => {
      l.push(calendarId);
    });
    await deleteCalender(
      { calendarId: calendarId },
      {
        update(cache) {
          const existingCalendars = cache.readQuery<GetMyCalendars>({
            query: GET_MY_CALENDARS,
          });
          const newCalendars = existingCalendars!.getMyCalendars.filter(
            (c) => c._id != calendarId
          );
          cache.writeQuery<GetMyCalendars>({
            query: GET_MY_CALENDARS,
            data: { getMyCalendars: newCalendars },
          });
        },
      }
    );
    updateCalendarsBeingDeleted((l) => l.filter((x) => x != calendarId));
  };

  const onHealthCheckClick = async (calendarId: string) => {
    updateCalendarHealthChecks((checks) => {
      const checkResult = checks.find((c) => c.calId == calendarId);
      if (checkResult) checkResult.loading = true;
      else checks.push({ calId: calendarId, loading: true });
    });
    const { data: result } =
      (await checkCalendarHealth({
        calendarId: calendarId,
      })) || {};
    if (!result) return;
    if (!result.checkCalendarHealth.healthy)
      message.error(
        <>
          <span>Die Verbindung zum Kalender ist fehlgeschlagen!</span>
          <br />
          <small>
            Bitte probiere, den Kalender zu löschen und ihn neu zu verknüpfen.
          </small>
        </>
      );
    updateCalendarHealthChecks((checks) => {
      const checkResult = checks.find((c) => c.calId == calendarId);
      if (checkResult) {
        checkResult.loading = false;
        checkResult.healthy = result.checkCalendarHealth.healthy;
      } else
        checks.push({
          calId: calendarId,
          loading: false,
          healthy: result.checkCalendarHealth.healthy,
        });
    });
  };

  const onCalendarEnabledChange = async (
    calendarId: string,
    enabled: boolean
  ) => {
    updateCalendarsWithPendingEnabledChange((l) => {
      l.push(calendarId);
    });
    await setCalendarEnabled({
      calendarId: calendarId,
      enabled,
    });
    updateCalendarsWithPendingEnabledChange((l) =>
      l.filter((x) => x != calendarId)
    );
  };

  return (
    <List
      itemLayout="horizontal"
      loading={calendarsLoading}
      dataSource={calendars}
      locale={{ emptyText: "Du hast bisher keine Kalender verknüpft" }}
      renderItem={(cal) => {
        const healthCheckResult = calendarHealthChecks.find(
          (h) => h.calId == cal._id
        );
        return (
          <List.Item
            actions={[
              <Switch
                size="small"
                loading={calendarsWithPendingEnabledChange.some(
                  (p) => p == cal._id
                )}
                checked={cal.enabled}
                onChange={async (enabled) => {
                  onCalendarEnabledChange(cal._id, enabled);
                }}
              />,
              <Tooltip
                title={healthCheckResult ? null : "Verknüpfung überprüfen"}
              >
                <Button
                  size="small"
                  key="check"
                  loading={healthCheckResult?.loading}
                  icon={getIconForHealthCheck(healthCheckResult)}
                  type={
                    healthCheckResult && healthCheckResult.healthy
                      ? "primary"
                      : "default"
                  }
                  danger={
                    healthCheckResult &&
                    typeof healthCheckResult.healthy !== "undefined" &&
                    !healthCheckResult.healthy
                  }
                  onClick={async () => onHealthCheckClick(cal._id)}
                />
              </Tooltip>,
              <Popconfirm
                title="Soll die Kalenderverknüpfung wirklich gelöscht werden?"
                onConfirm={async () => onDeleteClick(cal._id)}
                okText="Ja"
                cancelText="Abbrechen"
                placement="left"
              >
                <Button
                  size="small"
                  key="delete"
                  loading={calendarsBeingDeleted.some((c) => c == cal._id)}
                  icon={<DeleteOutlined />}
                />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Avatar icon={getIconForCalendarProvider(cal.provider)} />
              }
              title={
                cal.enabled
                  ? cal.friendlyName
                  : `${cal.friendlyName} (deaktiviert)`
              }
              description={cal.usernameAtProvider}
            />
          </List.Item>
        );
      }}
    />
  );
};

export { CalendarList };

