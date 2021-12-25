import { gql } from "@apollo/client";
import { CREATE_OR_UPDATE_POLL } from "@operations/mutations/CreateOrUpdatePoll";
import {
  CreateOrUpdatePoll,
  CreateOrUpdatePollVariables,
  CreateOrUpdatePoll_createOrUpdatePoll
} from "@operations/mutations/__generated__/CreateOrUpdatePoll";
import { GetPollByLink_getPollByLink } from "@operations/queries/__generated__/GetPollByLink";
import { useStyledMutation } from "@util/mutationWrapper";
import { Button, Card, Collapse, Form, Input } from "antd";
import React, { useState } from "react";
import { PollOptionType } from "__generated__/globalTypes";
import { OptionEditor, OptionEditorType } from "./PollEditDialog/OptionEditor";

const autocreateLinkFromTitle = (title: string) => {
  return title
    .replaceAll(" ", "-")
    .replaceAll("ä", "ae")
    .replaceAll("Ä", "AE")
    .replaceAll("ö", "oe")
    .replaceAll("Ö", "OE")
    .replaceAll("ü", "ue")
    .replaceAll("Ü", "UE")
    .replaceAll(/(?![\w-])./g, "");
};

const mapOptionTypeToEditorType = (t?: PollOptionType) => {
  if (t == PollOptionType.Arbitrary) return OptionEditorType.Arbitrary;
  else if (t) return OptionEditorType.Calendar;
  else return null;
};

const getWindowOrigin = () =>
  typeof window !== "undefined" && window.location.origin
    ? window.location.origin
    : "";

export const PollEditDialog = ({
  poll: _poll,
  title,
  saveButtonContent = "Speichern",
  saveButtonIcon,
  onSaveSuccess = (_) => {},
  onSaveFailure = () => {},
}: {
  poll?: Partial<GetPollByLink_getPollByLink>;
  title: string;
  saveButtonIcon?: JSX.Element;
  saveButtonContent?: JSX.Element | string;
  onSaveSuccess?: (poll?: CreateOrUpdatePoll_createOrUpdatePoll) => any;
  onSaveFailure?: () => any;
}) => {
  const [form] = Form.useForm();

  const [linkModifiedManually, setLinkModifiedManually] = useState(
    !!_poll?.link
  ); //link is not marked as "modified manually" if there is not link given at the first place
  const [pollIsSaving, setPollIsSaving] = useState(false);

  const createOrUpdatePollMutation = useStyledMutation<
    CreateOrUpdatePoll,
    CreateOrUpdatePollVariables
  >(CREATE_OR_UPDATE_POLL, {
    statusCallbackFunction: setPollIsSaving,
    successMessage: "Umfrage gespeichert!",
    onSuccess: (r) => onSaveSuccess(r?.createOrUpdatePoll),
    onError: onSaveFailure,
  });

  const savePoll = async (
    _poll: Partial<CreateOrUpdatePoll_createOrUpdatePoll>
  ) => {
    const { __typename, ...poll } = _poll; //omit typename key
    await createOrUpdatePollMutation(
      {
        poll: {
          title: "",
          link: "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          ...poll,
          options:
            poll.options?.map((o) => {
              //omit typename key for each option
              const { __typename, ...rest } = o;
              return rest;
            }) || [],
        },
      },
      {
        update(cache, { data }) {
          cache.modify({
            fields: {
              getPolls(existingPolls: { __ref: string }[] = []) {
                const fragmentId = `Poll:${data?.createOrUpdatePoll._id}`;
                //dont update cache in case the fragment definition already exists
                if (existingPolls.some((p) => p.__ref == fragmentId))
                  return existingPolls;
                const newPollRef = cache.readFragment({
                  id: fragmentId,
                  fragment: gql`
                    fragment NewPoll on Poll {
                      _id
                      title
                      link
                      author {
                        anonName
                        user {
                          _id
                          name
                        }
                      }
                    }
                  `,
                });
                return [...existingPolls, newPollRef];
              },
            },
          });
        },
      }
    );
  };

  return (
    <Card style={{ width: "100%" }} title={title}>
      <Form
        form={form}
        initialValues={{
          ..._poll,
          editorType: mapOptionTypeToEditorType(
            _poll?.options?.length ? _poll.options[0].type : undefined
          ),
        }}
        layout="horizontal"
        onFinish={(e) => {
          const { editorType, ...newPollData } = e; //omit editor type, since it's a form key but not required for poll
          savePoll({ _id: _poll?._id, ...newPollData });
        }}
      >
        <Form.Item
          required={true}
          label="Name der Umfrage"
          name="title"
          style={{ marginBottom: 0 }}
          rules={[
            {
              required: true,
              message: "Es muss ein Name für die Umfrage angegeben werden",
            },
          ]}
        >
          <Input
            type="text"
            placeholder="Name der Umfrage"
            onChange={(e) => {
              if (!linkModifiedManually)
                form.setFieldsValue({
                  link: autocreateLinkFromTitle(e.target.value),
                });
            }}
          />
        </Form.Item>
        <Form.Item noStyle dependencies={["title"]}>
          {({ getFieldValue }) =>
            getFieldValue("title") ? (
              <Collapse ghost>
                <Collapse.Panel
                  key="1"
                  header="Erweiterte Einstellungen"
                  forceRender={true}
                >
                  <Form.Item
                    required={true}
                    label="Link zur Umfrage"
                    name="link"
                    rules={[
                      {
                        required: true,
                        message:
                          "Es muss ein Link für die Umfrage angegeben werden!",
                      },
                      {
                        pattern: /^[\w-]+$/g,
                        message:
                          "Der Link darf nur Buchstaben, Zahlen, Bindestriche und Unterstriche enthalten!",
                      },
                    ]}
                  >
                    <Input
                      type="text"
                      addonBefore={`${getWindowOrigin()}/p/`}
                      placeholder="Link zur Umfrage"
                      onChange={() => {
                        if (!linkModifiedManually)
                          setLinkModifiedManually(true);
                      }}
                    />
                  </Form.Item>
                </Collapse.Panel>
              </Collapse>
            ) : null
          }
        </Form.Item>

        <Form.Item noStyle dependencies={["options", "title"]}>
          {({ getFieldValue }) =>
            getFieldValue("title") ? (
              <OptionEditor
                pollTitle={getFieldValue("title")}
                options={getFieldValue("options")}
              />
            ) : null
          }
        </Form.Item>
        <Form.Item style={{ marginBottom: 0 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={saveButtonIcon}
            loading={pollIsSaving}
            style={{ float: "right", marginTop: 16 }}
          >
            {saveButtonContent}
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};
