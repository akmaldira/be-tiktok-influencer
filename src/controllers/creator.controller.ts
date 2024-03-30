import dataSource from "database/data-source";
import CreatorView from "database/entities/creator-view.entity";
import CreatorEntity from "database/entities/creator.entity";
import TiktokCountryEntity from "database/entities/tiktok-country.entity";
import TiktokIndustryEntity from "database/entities/tiktok-industry.entity";
import { creatorResponseSpec } from "dtos/creator.dto";
import { Request, Response } from "express";
import { searchCreatorQuerySpec } from "payload/request/creator.request";
import BaseResponse from "payload/response/base-response";
import tryCatchController from "utils/try-catch-controller";
import { parse } from "valibot";

export const getCreators = tryCatchController(
  async (req: Request, res: Response) => {
    const {
      pagination,
      country,
      industry,
      followers,
      engagementRate,
      language,
      address,
      category,
      keywords,
      hashtags,
    } = parse(searchCreatorQuerySpec, req.query);

    const getCreatorsQuery = dataSource.manager
      .createQueryBuilder(CreatorView, "creator")
      // .where("creator.visibility = true")
      .leftJoinAndSelect("creator.country", "country")
      .orderBy("creator.followerCount", "DESC");

    if (pagination) {
      getCreatorsQuery
        .limit(pagination.perPage)
        .offset(
          pagination.page ? (pagination.page - 1) * pagination.perPage : 0,
        );
    } else {
      getCreatorsQuery.limit(10);
    }

    if (country) {
      getCreatorsQuery.andWhere("country_id = :country", { country });
    }

    if (industry) {
      getCreatorsQuery.andWhere(`industries @> '[{ "id": "${industry}" }]'`);
    }

    if (followers) {
      getCreatorsQuery.andWhere(
        "creator.followerCount >= :from AND creator.followerCount <= :to",
        followers,
      );
    }

    if (engagementRate) {
      getCreatorsQuery.andWhere("creator.engagementRate >= :engagementRate", {
        engagementRate,
      });
    }

    if (language) {
      getCreatorsQuery.andWhere("creator.language = :language", { language });
    }

    if (address) {
      getCreatorsQuery.andWhere(
        `(creator.address)::text ilike '%${address}%'`,
        { address },
      );
    }

    if (category) {
      getCreatorsQuery.andWhere(
        `creator.potentialCategories @> '[["${category}"]]'`,
      );
    }

    if (keywords) {
      getCreatorsQuery.andWhere(
        `(creator.suggestedWords)::text ilike '%${keywords}%'`,
      );
    }

    if (hashtags) {
      getCreatorsQuery.andWhere(
        `(creator.textExtras)::text ilike '%${hashtags}%'`,
      );
    }

    const [creators, total] = await getCreatorsQuery.getManyAndCount();
    const creatorResponse = creators.map((creator) =>
      creatorResponseSpec(creator),
    );

    const response = BaseResponse.success(creatorResponse, {
      page: pagination?.page || 1,
      perPage: pagination?.perPage || 10,
      total: total,
    });
    return res.json(response);
  },
);

export const getFilterCreator = tryCatchController(
  async (req: Request, res: Response) => {
    const country = await TiktokCountryEntity.find({
      order: { value: "ASC" },
    });

    const industry = await TiktokIndustryEntity.find({
      order: { value: "ASC" },
    });

    const follower = [
      {
        id: 100,
        value: "100",
      },
      {
        id: 1000,
        value: "1,000",
      },
      {
        id: 10000,
        value: "10,000",
      },
      {
        id: 100000,
        value: "100,000",
      },
      {
        id: 1000000,
        value: "1,000,000",
      },
      {
        id: 10000000,
        value: "10,000,000",
      },
      {
        id: 100000000,
        value: "100,000,000",
      },
      {
        id: 1000000000,
        value: "1,000,000,000",
      },
    ];

    const engagementRate = [
      {
        id: "5",
        value: "5%",
      },
      {
        id: "10",
        value: "10%",
      },
      {
        id: "15",
        value: "15%",
      },
      {
        id: "20",
        value: "20%",
      },
      {
        id: "25",
        value: "25%",
      },
      {
        id: "30",
        value: "30%",
      },
    ];

    const contactBy = [
      {
        id: "email",
        value: "Email",
      },
      // {
      //   id: "phone",
      //   value: "Phone",
      // },
      // {
      //   id: "instagram",
      //   value: "Instagram",
      // },
    ];

    const language = await CreatorEntity.createQueryBuilder("creator")
      .select("DISTINCT creator.language")
      .orderBy("creator.language", "ASC")
      .getRawMany()
      .then((res) =>
        res.map((item) => ({
          id: item.language,
          value: item.language.toUpperCase(),
        })),
      );

    const category = await dataSource.manager.query(
      `SELECT DISTINCT potential_categorie as id, potential_categorie as value
      FROM tbl_creator_video, jsonb_array_elements(potential_categories) AS potential_categorie
      WHERE potential_categorie IS NOT NULL
      ORDER BY potential_categorie ASC;`,
    );

    // const address = await dataSource.manager.query(
    //   `SELECT DISTINCT address as id, address as value
    //   FROM tbl_creator_video
    //   WHERE address IS NOT NULL
    //   ORDER BY address ASC;`,
    // );

    // const keywords = await dataSource.manager.query(
    //   `SELECT DISTINCT suggested_word as id, suggested_word as value
    //   FROM tbl_creator_video, jsonb_array_elements(suggested_words) AS suggested_word
    //   WHERE suggested_word IS NOT NULL
    //   ORDER BY suggested_word ASC;`,
    // );

    // const hashtags = await dataSource.manager.query(
    //   `SELECT DISTINCT text_extras->'hashtagName' AS id, text_extras->'hashtagName' AS value
    //   FROM tbl_creator_video, jsonb_array_elements(text_extra) AS text_extras
    //   WHERE text_extras->'hashtagName' IS NOT NULL
    //   ORDER BY text_extras->'hashtagName' ASC;`,
    // );

    const response = BaseResponse.success({
      country,
      industry,
      follower,
      engagementRate,
      language,
      category,
      contactBy,
      // address,
      // keywords,
      // hashtags,
    });

    return res.json(response);
  },
);
