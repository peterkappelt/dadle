import { gql } from "@apollo/client";

export const DELETE_COMMENT = gql`
  mutation DeleteComment($pollId: ID!, $commentId: ID!) {
    deleteComment(pollId: $pollId, commentId: $commentId) {
      _id
      title
      link
      author
      updatedAt
      comments {
        _id
        by
        text
      }
      options {
        _id
        type
        from
        to
        title
      }
      participations {
        _id
        author
        choices {
          choice
          option
        }
      }
    }
  }
`;
