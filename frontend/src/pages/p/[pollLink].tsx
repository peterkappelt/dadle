import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  SaveOutlined
} from "@ant-design/icons";
import { ApolloError, useMutation, useQuery } from "@apollo/client";
import { CREATE_OR_UPDATE_PARTICIPATION } from "@operations/mutations/CreateOrUpdateParticipation";
import { DELETE_PARTICIPATION } from "@operations/mutations/DeleteParticipation";
import { CreateOrUpdateParticipation } from "@operations/mutations/__generated__/CreateOrUpdateParticipation";
import { DeleteParticipation } from "@operations/mutations/__generated__/DeleteParticipation";
import { GET_POLL_BY_LINK } from "@operations/queries/GetPollByLink";
import {
  GetPollByLink,
  GetPollByLink_getPollByLink_options,
  GetPollByLink_getPollByLink_participations,
  GetPollByLink_getPollByLink_participations_choices
} from "@operations/queries/__generated__/GetPollByLink";
import {
  Button,
  Card,
  Descriptions,
  Input,
  message,
  PageHeader,
  Popconfirm,
  Space
} from "antd";
import { NextPage } from "next";
import { useRouter } from "next/dist/client/router";
import NProgress from "nprogress";
import React, { useEffect, useState } from "react";
import { PollOptionType, YesNoMaybe } from "__generated__/globalTypes";

const ParticipantRow = ({
  name: _name,
  editable = false,
  onEditClick = () => {},
  onSaveClick = () => {},
  onDeleteClick = () => {},
}: {
  name: string;
  editable?: boolean;
  onEditClick?: () => any;
  onSaveClick?: (_newName: string) => any;
  onDeleteClick?: () => any;
}) => {
  const [name, setName] = useState(_name);

  return (
    <div className="pollpage--participant">
      <div className="pollpage--participant-name">
        {editable ? (
          <Input
            style={{ width: "300px" }}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        ) : (
          name
        )}
      </div>
      <div className="pollpage--participant-action-btn">
        {editable ? (
          <Space>
            <Popconfirm
              title="Soll die Antwort wirklich gelöscht werden?"
              okText="Ja"
              cancelText="Abbrechen"
              onConfirm={() => onDeleteClick()}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
            <Button
              type="primary"
              onClick={() => onSaveClick(name)}
              icon={<SaveOutlined />}
            />
          </Space>
        ) : (
          <Button icon={<EditOutlined />} onClick={() => onEditClick()} />
        )}
      </div>
    </div>
  );
};

const OptionTitle = ({
  option,
}: {
  option: GetPollByLink_getPollByLink_options;
}) => {
  const content = [];

  const from = option.from ? new Date(option.from) : null;
  const to = option.to ? new Date(option.to) : null;

  const padToTwoDigits = (n?: number) => String(n).padStart(2, "0");

  if (
    option.type == PollOptionType.Date ||
    option.type == PollOptionType.DateTime
  ) {
    content.push(
      <span key="weekday" className="pollpage--participation-option-weekday">
        {from?.toLocaleDateString(undefined, { weekday: "short" })}
      </span>
    );
    content.push(
      <span key="day" className="pollpage--participation-option-day">
        {from?.getDay()}
      </span>
    );
    content.push(
      <span key="month" className="pollpage--participation-option-month">
        {from?.toLocaleDateString(undefined, { month: "short" })}
      </span>
    );
  }
  if (option.type == PollOptionType.DateTime) {
    content.push(
      <span key="times" className="pollpage--participation-option-times">
        <span>
          {padToTwoDigits(from?.getHours())}
          <sup>{padToTwoDigits(from?.getMinutes())}</sup>
        </span>
        <span>
          {padToTwoDigits(to?.getHours())}
          <sup>{padToTwoDigits(to?.getMinutes())}</sup>
        </span>
      </span>
    );
  }
  if (option.type == PollOptionType.Arbitrary) {
    content.push(<span key="arb">{option.title}</span>);
  }

  return <div className="pollpage--participation-option">{content}</div>;
};

const OptionsRow = ({
  options,
}: {
  options: GetPollByLink_getPollByLink_options[];
}) => {
  return (
    <div className="pollpage--participation-option-row">
      {options.map((o, idx) => (
        <OptionTitle option={o} key={idx} />
      ))}
    </div>
  );
};

const ParticipationRow = ({
  options,
  participation: propParticipation,
  editable = false,
  onChoiceChange = () => {},
}: {
  options: GetPollByLink_getPollByLink_options[];
  participation: GetPollByLink_getPollByLink_participations;
  editable?: boolean;
  onChoiceChange?: (
    newChoices: GetPollByLink_getPollByLink_participations_choices[]
  ) => any;
}) => {
  const [participation, setParticipation] = useState(propParticipation);

  const mapChoiceToClassName = (c?: YesNoMaybe) => {
    switch (c) {
      case YesNoMaybe.Yes:
        return "pollpage--option-choice-yes";
      case YesNoMaybe.No:
        return "pollpage--option-choice-no";
      case YesNoMaybe.Maybe:
        return "pollpage--option-choice-maybe";
      default:
        return "";
    }
  };

  const mapChoiceToIcon = (c?: YesNoMaybe) => {
    switch (c) {
      case YesNoMaybe.Yes:
        return <CheckCircleOutlined />;
      case YesNoMaybe.No:
        return <CloseCircleOutlined />;
      case YesNoMaybe.Maybe:
        return <QuestionCircleOutlined />;
      default:
        return <></>;
    }
  };

  const deriveNextChoiceFromCurrent = (currentChoice: YesNoMaybe) => {
    switch (currentChoice) {
      case YesNoMaybe.Yes:
        return YesNoMaybe.No;
      case YesNoMaybe.No:
        return YesNoMaybe.Maybe;
      case YesNoMaybe.Maybe:
      default:
        return YesNoMaybe.Yes;
    }
  };

  const handleChoiceClick = (optionId: string) => {
    setParticipation((_participation) => {
      //TODO this object copy seems ugly, yet is necessary since _participations is frozen
      const oldChoices = _participation.choices.map((c) =>
        Object.assign({}, c)
      );

      const p = oldChoices.find((c) => c.option == optionId);
      if (p) {
        oldChoices
          .filter((c) => c.option == optionId)
          .forEach((c) => (c.choice = deriveNextChoiceFromCurrent(c.choice)));
      } else {
        oldChoices.push({
          option: optionId,
          choice: YesNoMaybe.Yes,
          __typename: "PollChoice",
        });
      }

      return { ..._participation, choices: oldChoices };
    });
  };

  useEffect(() => {
    onChoiceChange(participation.choices);
  }, [participation]);

  return (
    <div className="pollpage--participation-choice-row">
      {options?.map((o, idx) => {
        const p = participation.choices.find((c) => c.option == o._id);
        return (
          <div
            key={idx}
            className={`${mapChoiceToClassName(p?.choice)} ${
              editable ? "pollpage--option-choice-editable" : ""
            }`}
            onClick={(e) => {
              e.preventDefault();
              editable ? handleChoiceClick(p ? p.option : o._id) : null;
            }}
            onMouseDown={
              (e) =>
                e.preventDefault() /* prevent selecting text on page when double-clicking fast */
            }
          >
            {mapChoiceToIcon(p?.choice)}
          </div>
        );
      })}
    </div>
  );
};

const PollPage: NextPage = () => {
  const router = useRouter();
  const { pollLink } = router.query;

  const [editableParticipation, setEditableParticipation] =
    useState<GetPollByLink_getPollByLink_participations | null>(null);

  const { error, loading, data } = useQuery<GetPollByLink>(GET_POLL_BY_LINK, {
    skip: !pollLink,
    variables: { pollLink },
  });
  const { getPollByLink: poll } = data || {};

  const [createOrUpdateParticipationMutation] =
    useMutation<CreateOrUpdateParticipation>(CREATE_OR_UPDATE_PARTICIPATION);
  const [deleteParticipationMutation] =
    useMutation<DeleteParticipation>(DELETE_PARTICIPATION);

  const saveParticipation = async (
    newAuthorName: string,
    newChoices?: GetPollByLink_getPollByLink_participations_choices[]
  ) => {
    NProgress.start();
    try {
      await createOrUpdateParticipationMutation({
        variables: {
          pollId: poll?._id,
          participation: {
            ...editableParticipation,
            __typename: undefined,
            author: newAuthorName,
            choices: newChoices?.map((n) => ({
              ...n,
              __typename: undefined,
            })),
          },
        },
      });
      message.success("Antwort gespeichert!");
    } catch (ex) {
      let additionalMessage;
      if (ex instanceof ApolloError) {
        additionalMessage = (
          <>
            <br />
            <small>{ex.message}</small>
          </>
        );
      }
      message.error(
        <>
          <span>Speichern fehlgeschlagen!</span>
          {additionalMessage}
        </>
      );
    } finally {
      NProgress.done();
      setEditableParticipation(null);
    }
  };

  const deleteParticipation = async (participationId: string) => {
    NProgress.start();
    try {
      await deleteParticipationMutation({
        variables: {
          pollId: poll?._id,
          participationId,
        },
        update(cache) {
          const normalizedId = cache.identify({
            id: participationId,
            __typename: "PollParticipation",
          });
          cache.evict({ id: normalizedId });
          cache.gc();
        },
      });
    } catch (ex) {
      let additionalMessage;
      if (ex instanceof ApolloError) {
        additionalMessage = (
          <>
            <br />
            <small>{ex.message}</small>
          </>
        );
      }
      message.error(
        <>
          <span>Löschen fehlgeschlagen!</span>
          {additionalMessage}
        </>
      );
    } finally {
      NProgress.done();
    }
  };

  if (loading) return <div>loading...</div>;
  if (error) return <div>An Error occured: {JSON.stringify(error)}</div>;

  return (
    <>
      <PageHeader
        ghost={false}
        onBack={() => router.back()}
        title={poll?.title}
        subTitle={poll?.author}
        style={{ marginBottom: "16px" }}
      >
        <Descriptions size="small" column={3}>
          <Descriptions.Item label="Created">tbd</Descriptions.Item>
        </Descriptions>
      </PageHeader>
      <Card>
        <div className="pollpage--container">
          <div className="pollpage--participants">
            {poll?.participations.map((p, idx) => (
              <ParticipantRow
                key={idx}
                name={p.author}
                editable={editableParticipation?._id == p._id}
                onEditClick={() => setEditableParticipation(p)}
                onSaveClick={(e) =>
                  saveParticipation(e, editableParticipation?.choices)
                }
                onDeleteClick={() => deleteParticipation(p._id)}
              />
            ))}
          </div>
          <div className="pollpage--participations-container">
            <OptionsRow key="optionstitles" options={poll?.options || []} />
            <div className="pollpage--participations">
              {poll?.participations.map((p, idx) => (
                <ParticipationRow
                  key={idx}
                  participation={p}
                  options={poll.options}
                  editable={editableParticipation?._id == p._id}
                  onChoiceChange={(c) =>
                    setEditableParticipation((p) => {
                      return p ? { ...p, choices: c } : null;
                    })
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    </>
  );
};

export default PollPage;
